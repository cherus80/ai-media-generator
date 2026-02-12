const EXACT_ERROR_TRANSLATIONS: Record<string, string> = {
  'Invalid authentication credentials': 'Неверные учётные данные авторизации',
  'User not found': 'Пользователь не найден',
  'User is banned': 'Пользователь заблокирован',
  'User is not active': 'Пользователь не активен',
  'Admin access required. Insufficient permissions.': 'Требуются права администратора. Недостаточно прав.',
  'Super admin access required. Only the main administrator can perform this action.':
    'Требуются права супер-администратора. Только главный администратор может выполнить это действие.',
  'Insufficient stars': 'Недостаточно ⭐️звёзд',
  'Invalid upload URL': 'Некорректная ссылка загрузки',
  'Email already registered': 'Электронная почта уже зарегистрирована',
  'Invalid email or password': 'Неверный email или пароль',
  'User account is blocked': 'Аккаунт пользователя заблокирован',
  'Google OAuth is not configured. Please use email/password authentication.':
    'Авторизация через Google не настроена. Используйте вход по email/паролю.',
  'Email not provided by Google. Please allow email access.':
    'Google не предоставил адрес электронной почты. Разрешите доступ к почте.',
  'VK OAuth is not configured. Please use email/password authentication.':
    'Авторизация через VK не настроена. Используйте вход по email/паролю.',
  'VK OAuth response missing access_token': 'Ответ VK OAuth не содержит access_token',
  'VK user info is empty': 'Не удалось получить данные пользователя VK',
  'VK user ID not provided by VK.': 'VK не вернул ID пользователя',
  'Yandex OAuth is not configured. Please use email/password authentication.':
    'Авторизация через Яндекс не настроена. Используйте вход по email/паролю.',
  'Yandex user ID not provided by Yandex.': 'Яндекс не вернул ID пользователя',
  'Telegram Login Widget is not configured. Please set TELEGRAM_BOT_TOKEN.':
    'Виджет входа Telegram не настроен. Укажите TELEGRAM_BOT_TOKEN.',
  'Telegram auth is not configured. Please set TELEGRAM_BOT_TOKEN.':
    'Авторизация через Telegram не настроена. Укажите TELEGRAM_BOT_TOKEN.',
  'Email verification is disabled': 'Подтверждение email отключено',
  'User does not have an email address': 'У пользователя отсутствует email-адрес',
  'Billing v5 is disabled': 'Платёжный модуль v5 отключён',
  'Ledger is disabled': 'Журнал операций отключён',
  'Mock payment endpoints are only available in PAYMENT_MOCK_MODE':
    'Эндпоинты тестовых платежей доступны только в режиме PAYMENT_MOCK_MODE',
  'Failed to get payment confirmation URL': 'Не удалось получить ссылку подтверждения платежа',
  'Missing signature': 'Отсутствует подпись',
  'Invalid signature': 'Некорректная подпись',
  'Payment not found': 'Платёж не найден',
  'No user_ids provided': 'Не переданы user_ids',
  'No users found for notification': 'Не найдено пользователей для уведомления',
  'Cannot block yourself': 'Нельзя заблокировать самого себя',
  'Only super admin can manage admin block status':
    'Только супер-администратор может управлять блокировкой администраторов',
  'Cannot delete yourself': 'Нельзя удалить самого себя',
  'Only super admin can delete another super admin':
    'Только супер-администратор может удалить другого супер-администратора',
  'Network Error': 'Сетевая ошибка. Проверьте подключение к интернету.',
};

const PREFIX_TRANSLATIONS: Array<[string, string]> = [
  ['Invalid token: ', 'Невалидный токен: '],
  ['Invalid Telegram initData: ', 'Некорректные данные Telegram initData: '],
  ['Invalid Google ID token: ', 'Некорректный Google ID token: '],
  ['Invalid VK authorization code: ', 'Некорректный код авторизации VK: '],
  ['Invalid VK token: ', 'Некорректный токен VK: '],
  ['Invalid VK ID token: ', 'Некорректный VK ID token: '],
  ['Invalid Yandex OAuth code: ', 'Некорректный OAuth-код Яндекса: '],
  ['Invalid Telegram widget data: ', 'Некорректные данные Telegram Widget: '],
  ['Unknown subscription plan: ', 'Неизвестный тариф подписки: '],
  ['Failed to read image dimensions: ', 'Не удалось определить размеры изображения: '],
  ['AI service error: ', 'Ошибка AI-сервиса: '],
  ['Payment service error: ', 'Ошибка платёжного сервиса: '],
  ['Invalid credits amount. Available: ', 'Некорректное количество ⭐️звёзд. Доступные варианты: '],
];

const localizeByPattern = (message: string): string => {
  const paymentMatch = message.match(/^Payment\s+(.+)\s+not found$/i);
  if (paymentMatch) {
    return `Платёж ${paymentMatch[1]} не найден`;
  }

  const userIdMatch = message.match(/^User with ID\s+(.+)\s+not found$/i);
  if (userIdMatch) {
    return `Пользователь с ID ${userIdMatch[1]} не найден`;
  }

  const userEmailMatch = message.match(/^User with email '(.+)' not found$/i);
  if (userEmailMatch) {
    return `Пользователь с email '${userEmailMatch[1]}' не найден`;
  }

  return message;
};

export const localizeErrorMessage = (message: unknown): string => {
  if (typeof message !== 'string') {
    return 'Произошла ошибка. Попробуйте ещё раз.';
  }

  const trimmed = message.trim();
  if (!trimmed) {
    return 'Произошла ошибка. Попробуйте ещё раз.';
  }

  if (EXACT_ERROR_TRANSLATIONS[trimmed]) {
    return EXACT_ERROR_TRANSLATIONS[trimmed];
  }

  for (const [prefix, localizedPrefix] of PREFIX_TRANSLATIONS) {
    if (trimmed.startsWith(prefix)) {
      return `${localizedPrefix}${trimmed.slice(prefix.length)}`;
    }
  }

  if (trimmed.toLowerCase() === 'field required') {
    return 'Обязательное поле';
  }

  if (trimmed.toLowerCase().includes('value is not a valid email')) {
    return 'Некорректный email-адрес';
  }

  return localizeByPattern(trimmed);
};

export const localizeErrorDetail = (detail: unknown): unknown => {
  if (typeof detail === 'string') {
    return localizeErrorMessage(detail);
  }

  if (Array.isArray(detail)) {
    return detail.map((item) => {
      if (item && typeof item === 'object' && 'msg' in (item as Record<string, unknown>)) {
        const typedItem = item as Record<string, unknown>;
        return {
          ...typedItem,
          msg: localizeErrorMessage(typedItem.msg),
        };
      }
      return item;
    });
  }

  if (detail && typeof detail === 'object') {
    const typedDetail = detail as Record<string, unknown>;
    if (typeof typedDetail.message === 'string') {
      return {
        ...typedDetail,
        message: localizeErrorMessage(typedDetail.message),
      };
    }
  }

  return detail;
};
