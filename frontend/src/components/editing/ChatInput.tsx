/**
 * Компонент ввода сообщения в чат
 * Textarea с автоматическим ростом и кнопкой отправки
 */

import React from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  disabled = false,
  placeholder = 'Опишите, как хотите изменить изображение...',
}) => {
  const [message, setMessage] = React.useState('');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const { user } = useAuthStore();

  // Автоматическая подстройка высоты textarea
  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  const handleSubmit = () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || disabled) {
      return;
    }

    onSend(trimmedMessage);
    setMessage('');

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

  return (
    <div className="border border-primary-100 backdrop-blur-md bg-white/80 px-4 py-4 shadow-soft rounded-2xl mb-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-end space-x-3">
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
              className="w-full px-5 py-4 glass border-2 border-primary-200 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-dark-900 placeholder-dark-400 font-medium"
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

          {/* Send button */}
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={handleSubmit}
              disabled={!message.trim() || disabled}
              variant="primary"
              size="lg"
              className="!rounded-full !p-4 shadow-glow-primary"
              isLoading={disabled}
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              }
            />
          </motion.div>
        </div>

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
              {user.subscription_type && user.subscription_type !== 'none' && (
                <Badge variant="primary" size="sm" dot>
                  {user.subscription_type}
                </Badge>
              )}
              {user.freemium_actions_remaining && user.freemium_actions_remaining > 0 && (
                <Badge variant="success" size="sm" dot>
                  {user.freemium_actions_remaining} бесплатных
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
      </div>
    </div>
  );
};
