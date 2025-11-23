import { useState } from 'react';
import { useAuth } from '../../store/authStore';
import { sendVerificationEmail } from '../../api/authWeb';

export function EmailVerificationBanner() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  // Не показываем баннер если:
  // - Нет пользователя
  // - Email уже подтвержден
  // - Нет email (OAuth пользователи с подтвержденным email)
  // - Баннер был закрыт
  if (!user || user.email_verified || !user.email || isDismissed) {
    return null;
  }

  const handleResendEmail = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await sendVerificationEmail();
      setMessage({ type: 'success', text: response.message });

      // Скрыть success сообщение через 5 секунд
      setTimeout(() => {
        setMessage(null);
      }, 5000);
    } catch (error: any) {
      const errorText = error.response?.data?.detail || 'Не удалось отправить письмо';
      setMessage({ type: 'error', text: errorText });

      // Скрыть error сообщение через 5 секунд
      setTimeout(() => {
        setMessage(null);
      }, 5000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-yellow-400"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-yellow-800">
            Подтвердите ваш email
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <p>
              Пожалуйста, подтвердите ваш email-адрес <strong>{user.email}</strong>, чтобы получить полный доступ ко всем функциям.
            </p>

            {message && (
              <div className={`mt-2 p-2 rounded ${
                message.type === 'success'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {message.text}
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={handleResendEmail}
              disabled={isLoading}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-yellow-800 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Отправка...
                </>
              ) : (
                'Отправить письмо снова'
              )}
            </button>

            <button
              onClick={() => setIsDismissed(true)}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-yellow-800 bg-transparent hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition-colors"
            >
              Скрыть
            </button>
          </div>
        </div>

        <div className="ml-auto pl-3">
          <button
            onClick={() => setIsDismissed(true)}
            className="-mx-1.5 -my-1.5 bg-yellow-50 text-yellow-500 rounded-lg focus:ring-2 focus:ring-yellow-600 p-1.5 hover:bg-yellow-100 inline-flex h-8 w-8 items-center justify-center"
          >
            <span className="sr-only">Закрыть</span>
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
