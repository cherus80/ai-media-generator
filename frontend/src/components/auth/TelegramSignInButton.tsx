/**
 * Компонент кнопки входа через Telegram (Login Widget)
 */

import { useEffect, useRef } from 'react';
import { useAuth } from '../../store/authStore';

interface TelegramUser {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    auth_date: number;
    hash: string;
}

interface TelegramSignInButtonProps {
    onSuccess?: () => void;
    onError?: (error: string) => void;
    className?: string;
    disabled?: boolean;
}

export function TelegramSignInButton({ onSuccess, onError, className, disabled = false }: TelegramSignInButtonProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const { loginWithTelegramWidget } = useAuth();
    const botName = import.meta.env.VITE_TELEGRAM_BOT_NAME;

    useEffect(() => {
        if (!containerRef.current || !botName || disabled) return;

        // Create script element
        const script = document.createElement('script');
        script.src = 'https://telegram.org/js/telegram-widget.js?22';
        script.setAttribute('data-telegram-login', botName);
        script.setAttribute('data-size', 'large');
        script.setAttribute('data-radius', '12');
        script.setAttribute('data-request-access', 'write');
        script.setAttribute('data-userpic', 'false');
        script.async = true;

        // Define callback function name
        const callbackName = `onTelegramAuth_${Math.floor(Math.random() * 1000000)}`;
        script.setAttribute('data-onauth', `${callbackName}(user)`);

        // Assign callback to window
        // @ts-ignore
        window[callbackName] = async (user: TelegramUser) => {
            try {
                await loginWithTelegramWidget(user);
                onSuccess?.();
            } catch (error: any) {
                console.error('Telegram login error:', error);
                onError?.(error.message || 'Ошибка входа через Telegram');
            }
        };

        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(script);

        return () => {
            // Cleanup
            // @ts-ignore
            delete window[callbackName];
        };
    }, [botName, disabled]);

    if (!botName) {
        return (
            <div className={`flex items-center justify-center h-12 rounded-xl border border-slate-200 bg-white text-slate-400 text-xs ${className}`}>
                Telegram не настроен
            </div>
        )
    }

    return (
        <div
            ref={containerRef}
            className={`flex justify-center items-center overflow-hidden h-12 min-h-[48px] ${className} ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        />
    );
}
