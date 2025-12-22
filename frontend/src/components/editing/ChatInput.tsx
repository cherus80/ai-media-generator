/**
 * Компонент ввода сообщения в чат
 * Textarea с автоматическим ростом и кнопкой отправки
 */

import React from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { uploadAttachment } from '../../api/editing';
import type { ChatAttachment } from '../../types/editing';
import toast from 'react-hot-toast';

interface ChatInputProps {
  onSend: (message: string, attachments?: ChatAttachment[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  disabled = false,
  placeholder = 'Опишите, как хотите изменить изображение...',
}) => {
  const [message, setMessage] = React.useState('');
  const [attachments, setAttachments] = React.useState<ChatAttachment[]>([]);
  const [previews, setPreviews] = React.useState<Record<string, string>>({});
  const [isUploadingAttachment, setIsUploadingAttachment] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { user } = useAuthStore();

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

  const handleSubmit = () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || disabled || isUploadingAttachment) {
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

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/mpo'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Поддерживаются изображения JPEG/PNG/WebP/HEIC');
      e.target.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Размер файла до 10MB');
      e.target.value = '';
      return;
    }

    setIsUploadingAttachment(true);
    try {
      const uploaded: ChatAttachment = await uploadAttachment(file);
      setAttachments((prev) => [...prev, uploaded]);
      setPreviews((prev) => ({
        ...prev,
        [uploaded.id]: URL.createObjectURL(file),
      }));
      toast.success('Файл прикреплён');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || err?.message || 'Не удалось загрузить файл');
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

  return (
    <div className="border border-primary-100 backdrop-blur-md bg-white/80 px-2 sm:px-4 py-3 sm:py-4 shadow-soft rounded-2xl mb-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-end space-x-2 sm:space-x-3">
          {/* Textarea */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              rows={1}
              className="w-full px-3 sm:px-5 py-3 sm:py-4 glass border-2 border-primary-200 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-dark-900 placeholder-dark-400 font-medium text-sm sm:text-base"
              style={{ maxHeight: '200px' }}
            />
            {/* Hint text */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: message.length === 0 ? 1 : 0 }}
              className="absolute right-4 bottom-3 text-xs text-dark-400 font-medium pointer-events-none"
            >
              Enter для отправки
            </motion.div>
          </div>

          {/* Attach button */}
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={handleFileButtonClick}
              disabled={disabled || isUploadingAttachment}
              variant="outline"
              size="lg"
              className="!rounded-full !p-4"
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.5 6.75v7.5a4.5 4.5 0 11-9 0v-9a3 3 0 116 0v8.25a1.5 1.5 0 11-3 0V7.5" />
                </svg>
              }
            />
          </motion.div>

          {/* Send button */}
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={handleSubmit}
              disabled={!message.trim() || disabled || isUploadingAttachment}
              variant="primary"
              size="lg"
              className="!rounded-full !p-4 shadow-glow-primary"
              isLoading={disabled || isUploadingAttachment}
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
                💎 {user.balance_credits} кредитов
              </Badge>
              {hasActiveSubscription && (
                <Badge variant="primary" size="sm" dot>
                  Действия: {Math.max(user.subscription_ops_remaining || 0, 0)} / {user.subscription_ops_limit ?? 0}
                </Badge>
              )}
            </div>
            {message.length > 1500 && (
              <Badge
                variant={message.length > 1900 ? "danger" : "warning"}
                size="sm"
              >
                {message.length} / 2000
              </Badge>
            )}
          </motion.div>
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
