/**
 * Компонент кнопки Yandex ID входа (OAuth)
 */

import { useState } from 'react';

interface YandexSignInButtonProps {
    className?: string;
    disabled?: boolean;
}

export function YandexSignInButton({ className, disabled = false }: YandexSignInButtonProps) {
    const [isLoading, setIsLoading] = useState(false);
    const clientId = import.meta.env.VITE_YANDEX_CLIENT_ID;
    const redirectUri = import.meta.env.VITE_YANDEX_REDIRECT_URI || `${window.location.origin}/yandex/callback`;

    const handleClick = () => {
        if (disabled || !clientId) return;
        setIsLoading(true);

        // Redirect to Yandex OAuth
        const url = `https://oauth.yandex.ru/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
        window.location.href = url;
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={isLoading || !clientId || disabled}
            className={`w-full h-12 min-h-[48px] max-h-[48px] inline-flex items-center justify-center gap-2 px-4 rounded-xl border border-slate-200 bg-white shadow-sm hover:bg-slate-50 text-sm font-semibold text-slate-900 leading-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-200 disabled:opacity-60 disabled:cursor-not-allowed transition ${className || ''}`}
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                aria-hidden="true"
            >
                <text
                    x="50%"
                    y="50%"
                    textAnchor="middle"
                    dy=".35em"
                    fontSize="20"
                    fontWeight="900"
                    fill="#FC3F1D"
                    fontFamily="Arial, Helvetica, sans-serif"
                >
                    Я
                </text>
            </svg>
            {isLoading ? 'Переходим в Yandex...' : 'Войти через Яндекс ID'}
        </button>
    );
}
