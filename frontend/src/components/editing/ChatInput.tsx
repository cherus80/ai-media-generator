/**
 * Компонент ввода сообщения в чат
 * Textarea с автоматическим ростом и кнопкой отправки
 */

import React from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../ui/Button';
import { uploadAttachment } from '../../api/editing';
import { Badge } from '../ui/Badge';
import type { ChatAttachment } from '../../types/editing';
import toast from 'react-hot-toast';
import { getUploadErrorMessage } from '../../utils/uploadErrors';
import { compressImageFile } from '../../utils/imageCompression';
import type { AspectRatio } from '../../types/generation';

interface ChatInputProps {
  onSend: (message: string, attachments?: ChatAttachment[]) => void;
  disabled?: boolean;
  placeholder?: string;
  prefillMessage?: string;
  requireAttachments?: boolean;
  attachmentsHint?: string;
  attachmentTooltip?: string;
  aspectRatio?: AspectRatio;
  onAspectRatioChange?: (ratio: AspectRatio) => void;
  showAspectRatioSelect?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  disabled = false,
  placeholder = 'Опишите, как хотите изменить изображение...',
  prefillMessage,
  requireAttachments = false,
  attachmentsHint,
  attachmentTooltip,
  aspectRatio,
  onAspectRatioChange,
  showAspectRatioSelect = false,
}) => {
  const [message, setMessage] = React.useState('');
  const [attachments, setAttachments] = React.useState<ChatAttachment[]>([]);
  const [previews, setPreviews] = React.useState<Record<string, string>>({});
  const [isUploadingAttachment, setIsUploadingAttachment] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { user } = useAuthStore();
  const MAX_PROMPT_LENGTH = 4000;
  const warningThreshold = MAX_PROMPT_LENGTH - 500;
  const dangerThreshold = MAX_PROMPT_LENGTH - 100;
  const trimmedMessage = message.trim();
  const promptLength = trimmedMessage.length;
  const isPromptTooLong = promptLength > MAX_PROMPT_LENGTH;
  const CLIENT_MAX_FILE_SIZE = 10 * 1024 * 1024;
  const TARGET_UPLOAD_SIZE = 5 * 1024 * 1024;

  const hasActiveSubscription = !!(
    user?.subscription_type &&
    user.subscription_type !== 'none' &&
    user.subscription_expires_at &&
    new Date(user.subscription_expires_at) > new Date() &&
    (user.subscription_ops_remaining ?? 0) > 0
  );

  // Автоматическая подстройка высоты textarea
  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  React.useEffect(() => {
    if (prefillMessage && !message.trim()) {
      setMessage(prefillMessage);
    }
  }, [prefillMessage, message]);

  const handleSubmit = () => {
    if (!trimmedMessage || disabled || isUploadingAttachment) {
      return;
    }
    if (isPromptTooLong) {
      toast.error(
        `Промпт превышает ${MAX_PROMPT_LENGTH} символов. Сократите текст, чтобы продолжить.`
      );
      return;
    }
    if (requireAttachments && attachments.length === 0) {
      toast.error('Прикрепите хотя бы одно фото для генерации');
      return;
    }

    onSend(trimmedMessage, attachments);
    setMessage('');
    // чистим вложения после отправки
    Object.values(previews).forEach((url) => URL.revokeObjectURL(url));
    setAttachments([]);
    setPreviews({});

    // Сброс высоты textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter без Shift - отправка сообщения
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileButtonClick = () => {
    if (disabled || isUploadingAttachment) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (attachments.length >= 5) {
      toast.error('Можно прикрепить не более 5 изображений');
      e.target.value = '';
      return;
    }

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
      'image/mpo',
    ];
    if (!allowedTypes.includes(file.type)) {
      toast.error(
        'Неподдерживаемый формат. Используйте JPEG, PNG, WebP, HEIC/HEIF или MPO.'
      );
      e.target.value = '';
      return;
    }

    if (file.size > CLIENT_MAX_FILE_SIZE) {
      toast.error(
        'Файл слишком большой. Максимальный размер: 10MB. Сожмите изображение или выберите файл меньшего размера.'
      );
      e.target.value = '';
      return;
    }

    setIsUploadingAttachment(true);
    try {
      const compression = await compressImageFile(file, {
        maxSizeBytes: TARGET_UPLOAD_SIZE,
      });

      if (!compression.meetsLimit) {
        const isIphoneFormat = /heic|heif|mpo/i.test(file.type) || /\.(heic|heif|mpo)$/i.test(file.name);
        toast.error(
          isIphoneFormat
            ? 'Формат HEIC/HEIF/MPO нельзя сжать в браузере. Сохраните файл в JPEG/PNG или выберите фото меньшего размера.'
            : 'Не удалось сжать изображение до 5MB. Попробуйте другое фото или уменьшите размер.'
        );
        return;
      }

      const uploadFile = compression.file;
      const uploaded: ChatAttachment = await uploadAttachment(uploadFile);
      setAttachments((prev) => [...prev, uploaded]);
      setPreviews((prev) => ({
        ...prev,
        [uploaded.id]: URL.createObjectURL(uploadFile),
      }));
      toast.success('Файл прикреплён');
    } catch (err: any) {
      toast.error(
        getUploadErrorMessage(err, {
          kind: 'image',
          maxSizeMb: 5,
          allowedTypesLabel: 'JPEG, PNG, WebP, HEIC/HEIF, MPO',
          fallback: 'Не удалось загрузить файл. Попробуйте еще раз.',
        })
      );
    } finally {
      setIsUploadingAttachment(false);
      e.target.value = '';
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((att) => att.id !== id));
    if (previews[id]) {
      URL.revokeObjectURL(previews[id]);
      setPreviews((prev) => {
        const clone = { ...prev };
        delete clone[id];
        return clone;
      });
    }
  };

  const hintTextMobile =
    attachmentsHint === undefined ? 'Референсы через скрепку' : attachmentsHint;
  const hintTextDesktop =
    attachmentsHint === undefined
      ? 'Прикрепляйте референсы через скрепку слева'
      : attachmentsHint;
  const showHint = Boolean(hintTextMobile);

  return (
    <div className="border-2 border-primary-100 backdrop-blur-md bg-gradient-to-r from-white via-white to-primary-50/60 px-3 sm:px-5 py-4 sm:py-5 shadow-soft rounded-2xl mb-10 shadow-lg shadow-primary-100/60">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-2">
          <span className="text-sm font-semibold text-dark-700">
            Поле ввода запроса
          </span>
          {showHint && (
            <span className="text-xs text-primary-600 font-medium">
              <span className="inline sm:hidden">{hintTextMobile}</span>
              <span className="hidden sm:inline">{hintTextDesktop}</span>
            </span>
          )}
        </div>
        {showAspectRatioSelect && aspectRatio && onAspectRatioChange && (
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-dark-600">
            <span className="font-medium text-dark-700">Соотношение сторон:</span>
            <select
              value={aspectRatio}
              onChange={(e) => onAspectRatioChange(e.target.value as AspectRatio)}
              disabled={disabled || isUploadingAttachment}
              className="rounded-lg border border-primary-200 bg-white px-2 py-1 text-xs font-medium text-dark-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            >
              <option value="auto">Авто (по референсу)</option>
              <option value="1:1">1:1 (квадрат)</option>
              <option value="16:9">16:9 (горизонтальный)</option>
              <option value="9:16">9:16 (вертикальный)</option>
            </select>
            <span className="text-dark-500">Можно выбрать до запуска генерации.</span>
          </div>
        )}
        <div className="flex flex-wrap items-end gap-2 sm:gap-3">
          {/* Attach button слева */}
          <motion.div
            className="flex-shrink-0"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title={attachmentTooltip}
          >
            <Button
              onClick={handleFileButtonClick}
              disabled={disabled || isUploadingAttachment}
              variant="ghost"
              size="lg"
              className="!rounded-full !p-4 bg-white/80 text-primary-700 shadow-sm hover:bg-primary-50 border border-transparent"
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.5 6.75v7.5a4.5 4.5 0 11-9 0v-9a3 3 0 116 0v8.25a1.5 1.5 0 11-3 0V7.5" />
                </svg>
              }
            />
          </motion.div>

          {/* Textarea */}
          <div className="flex-1 min-w-0 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              rows={1}
              className="w-full px-3 sm:px-5 py-3 sm:py-4 glass border-2 border-primary-400 rounded-2xl resize-none focus:outline-none focus:ring-4 focus:ring-primary-400/90 focus:border-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-dark-900 placeholder-dark-500 font-medium text-sm sm:text-base shadow-[inset_0_3px_12px_rgba(0,0,0,0.18)] bg-white/95"
              style={{ maxHeight: '200px' }}
            />
            {/* Hint text */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: message.length === 0 ? 1 : 0 }}
            className="absolute right-4 bottom-3 text-xs text-dark-400 font-medium pointer-events-none hidden sm:block"
          >
              Enter для отправки
            </motion.div>
          </div>

          {/* Send button */}
          <motion.div className="flex-shrink-0" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={handleSubmit}
              disabled={
                !trimmedMessage ||
                disabled ||
                isUploadingAttachment ||
                isPromptTooLong ||
                (requireAttachments && attachments.length === 0)
              }
              variant="primary"
              size="lg"
              className="!rounded-full !p-4 shadow-glow-primary"
              isLoading={disabled || isUploadingAttachment}
              loadingLabel=""
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              }
            />
          </motion.div>
        </div>

        {/* Attachments preview */}
        {attachments.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-3">
            {attachments.map((att) => (
              <div key={att.id} className="relative w-16 h-16 rounded-xl overflow-hidden border border-primary-200 bg-white shadow-sm">
                {previews[att.id] ? (
                  <img src={previews[att.id]} alt={att.name || 'attachment'} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-dark-500 bg-dark-50">
                    IMG
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(att.id)}
                  className="absolute -top-2 -right-2 bg-white rounded-full shadow border border-primary-200 p-1 text-dark-600 hover:text-danger-500"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Balance and Freemium info */}
        {user && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-3 flex items-center justify-between text-xs"
          >
            <div className="flex items-center flex-wrap gap-2">
              <Badge variant="neutral" size="sm">
                ⭐️ {user.balance_credits} звезд
              </Badge>
              {hasActiveSubscription && (
                <Badge variant="primary" size="sm" dot>
                  Генерации: {Math.max(user.subscription_ops_remaining || 0, 0)} / {user.subscription_ops_limit ?? 0}
                </Badge>
              )}
            </div>
            {promptLength > warningThreshold && (
              <Badge
                variant={promptLength > MAX_PROMPT_LENGTH || promptLength > dangerThreshold ? 'danger' : 'warning'}
                size="sm"
              >
                {promptLength} / {MAX_PROMPT_LENGTH}
              </Badge>
            )}
          </motion.div>
        )}
        {isPromptTooLong && (
          <div className="mt-2 text-xs font-semibold text-danger-700">
            Промпт превышает лимит {MAX_PROMPT_LENGTH} символов. Сократите текст, чтобы запустить генерацию.
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/mpo"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
};
