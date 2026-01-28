import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { verifyEmail } from '../api/authWeb';
import { useAuth } from '../store/authStore';

type VerificationState = 'loading' | 'success' | 'error' | 'invalid';

export function EmailVerificationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setUser, setToken } = useAuth();

  const [state, setState] = useState<VerificationState>('loading');
  const [message, setMessage] = useState('');
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setState('invalid');
      setMessage('Токен верификации не найден');
      return;
    }

    const verify = async () => {
      try {
        const response = await verifyEmail(token);

        // Обновляем пользователя и токен (если вернули access_token)
        setUser(response.user);
        if (response.access_token) {
          setToken(response.access_token);
        }

        setState('success');
        setMessage(response.message);

        // Покажем тост после редиректа на главную
        sessionStorage.setItem(
          'emailVerifiedMessage',
          response.message || 'Email подтверждён! Теперь можно пользоваться приложением.'
        );

        // Редирект в приложение через 2 секунды
        setTimeout(() => {
          navigate('/app', { replace: true });
        }, 2000);
      } catch (error: any) {
        setState('error');

        const detail = error.response?.data?.detail || 'Не удалось подтвердить email';
        setMessage(detail);
      }
    };

    verify();
  }, [token, navigate, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          {/* Icon */}
          <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-full mb-6">
            {state === 'loading' && (
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
            )}
            {state === 'success' && (
              <svg
                className="h-16 w-16 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            )}
            {state === 'error' && (
              <svg
                className="h-16 w-16 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            )}
            {state === 'invalid' && (
              <svg
                className="h-16 w-16 text-yellow-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            )}
          </div>

          {/* Title */}
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            {state === 'loading' && 'Подтверждение email...'}
            {state === 'success' && 'Email подтверждён!'}
            {state === 'error' && 'Ошибка верификации'}
            {state === 'invalid' && 'Неверная ссылка'}
          </h2>

          {/* Message */}
          <p className="text-lg text-gray-600 mb-8">{message}</p>

          {/* Success redirect message */}
          {state === 'success' && (
            <p className="text-sm text-gray-500 mb-6">
              Перенаправление в приложение через 2 секунды...
            </p>
          )}

          {/* Action buttons */}
          <div className="space-y-3">
            {state === 'success' && (
              <Link
                to="/app"
                className="inline-block w-full px-6 py-3 text-base font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Перейти в приложение
              </Link>
            )}

            {state === 'error' && (
              <>
                <Link
                  to="/profile"
                  className="inline-block w-full px-6 py-3 text-base font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  Запросить новое письмо
                </Link>
                <Link
                  to="/"
                  className="inline-block w-full px-6 py-3 text-base font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Вернуться на главную
                </Link>
              </>
            )}

            {state === 'invalid' && (
              <Link
                to="/"
                className="inline-block w-full px-6 py-3 text-base font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Вернуться на главную
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
