/**
 * Компонент подтверждения/редактирования промпта, предложенного AI (1 или несколько вариантов)
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

interface PromptSelectorProps {
  prompts: string[];
  onSelect: (prompt: string) => void;
  isGenerating?: boolean;
}

export const PromptSelector: React.FC<PromptSelectorProps> = ({
  prompts,
  onSelect,
  isGenerating = false,
}) => {
  const [selectedPrompt, setSelectedPrompt] = React.useState<string | null>(null);
  const [editingPrompt, setEditingPrompt] = React.useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = React.useState<string>('');
  const promptAssistantModel =
    import.meta.env.VITE_PROMPT_ASSISTANT_MODEL || 'AI-ассистент';
  const isSinglePrompt = prompts.length === 1;

  if (prompts.length === 0) {
    return null;
  }

  const handleSelect = (prompt: string) => {
    setSelectedPrompt(prompt);
    onSelect(prompt);
  };

  const handleEdit = (prompt: string) => {
    setEditingPrompt(prompt);
    setCustomPrompt(prompt);
  };

  const handleSaveEdit = () => {
    if (customPrompt.trim()) {
      handleSelect(customPrompt.trim());
      setEditingPrompt(null);
      setCustomPrompt('');
    }
  };

  const handleCancelEdit = () => {
    setEditingPrompt(null);
    setCustomPrompt('');
  };

  const promptLabels = [
    { label: 'Короткий', icon: '⚡', variant: 'primary' as const },
    { label: 'Средний', icon: '✨', variant: 'secondary' as const },
    { label: 'Детальный', icon: '🎨', variant: 'accent' as const },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="my-6"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-3">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg mr-3">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <p className="text-base font-bold gradient-text">
            Подтвердите или отредактируйте финальный промпт
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="primary" size="sm">{promptAssistantModel}</Badge>
          <Badge variant="warning" size="sm">Ассистент −1 кредит</Badge>
      </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {prompts.slice(0, 3).map((prompt, index) => {
          const fallbackLabel = { label: 'Финальный', icon: '🎯', variant: 'primary' as const };
          const { label, icon, variant } = isSinglePrompt ? fallbackLabel : (promptLabels[index] || promptLabels[0]);
          const isEditing = editingPrompt === prompt;
          const isSelected = selectedPrompt === prompt;

          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <Card
                variant={isSelected ? 'gradient' : 'glass'}
                padding="lg"
                hover={!isEditing}
                className={`transition-all ${
                  isSelected ? 'border-2 border-primary-400 shadow-glow-primary' : 'border border-white/20'
                }`}
              >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">{icon}</span>
                  <Badge variant={variant} size="md">
                    {label}
                  </Badge>
                </div>
                <div className="flex items-center space-x-2">
                  {!isEditing && !isGenerating && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(prompt)}
                      icon={
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      }
                    >
                      Изменить
                    </Button>
                  )}
                </div>
              </div>

              {/* Prompt text or edit field */}
              {isEditing ? (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    className="w-full px-4 py-3 glass border-2 border-primary-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-medium text-dark-900"
                    rows={4}
                  />
                  <div className="mt-3 flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      size="md"
                      onClick={handleCancelEdit}
                    >
                      Отмена
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      onClick={handleSaveEdit}
                      disabled={!customPrompt.trim()}
                      icon={
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      }
                    >
                      Генерировать
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <>
                  <p className="text-sm text-dark-700 mb-4 leading-relaxed">
                    {prompt}
                  </p>

                  {/* Generate button */}
                  <Button
                    onClick={() => handleSelect(prompt)}
                    disabled={isGenerating}
                    variant={isSelected ? 'success' : 'primary'}
                    size="lg"
                    fullWidth
                    isLoading={isGenerating && isSelected}
                    icon={
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    }
                  >
                    {isGenerating && isSelected ? 'Генерируем...' : 'Генерировать изображение'}
                  </Button>
                </>
              )}
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Info hint */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-4"
      >
        <Card variant="glass" padding="md" className="border border-primary-200">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm text-dark-700 leading-relaxed">
                <span className="font-semibold">Генерация изображения списывает 2 кредита.</span> AI-ассистент уже списал 1 кредит за улучшение промпта — подтвердите или подредактируйте перед стартом.
              </p>
            </div>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
};
