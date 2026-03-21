import {
  INDEX_FOLLOW_ROBOTS,
  NOINDEX_FOLLOW_ROBOTS,
  getRobotsContent,
} from '../src/hooks/useSeo';
import { resolveRouteSeo } from '../src/seo/routeSeo';

describe('route SEO contract', () => {
  test('uses noindex,follow for service routes and index,follow for public routes', () => {
    expect(NOINDEX_FOLLOW_ROBOTS).toBe('noindex,follow');
    expect(getRobotsContent(true)).toBe('noindex,follow');
    expect(INDEX_FOLLOW_ROBOTS).toBe('index, follow');
    expect(getRobotsContent(false)).toBe('index, follow');
  });

  test.each([
    ['/login', 'Вход в аккаунт — ИИ Генератор', true, 'https://ai-generator.mix4.ru/login'],
    ['/register', 'Регистрация — ИИ Генератор', true, 'https://ai-generator.mix4.ru/register'],
    ['/forgot-password', 'Восстановление пароля — ИИ Генератор', true, 'https://ai-generator.mix4.ru/forgot-password'],
    ['/app', 'Личный кабинет — ИИ Генератор', true, 'https://ai-generator.mix4.ru/app'],
    ['/app/about', 'О приложении — ИИ Генератор', true, 'https://ai-generator.mix4.ru/app/about'],
    ['/app/examples', 'Примеры генераций в приложении — ИИ Генератор', true, 'https://ai-generator.mix4.ru/app/examples'],
    ['/app/instructions', 'Инструкции по использованию — ИИ Генератор', true, 'https://ai-generator.mix4.ru/app/instructions'],
    ['/pricing', 'Тарифы на виртуальную примерку и генерацию фото — ИИ Генератор', false, 'https://ai-generator.mix4.ru/pricing'],
    ['/privacy', 'Политика конфиденциальности сервиса ИИ Генератор', false, 'https://ai-generator.mix4.ru/privacy'],
    ['/contacts', 'Контакты и реквизиты — ИИ Генератор', false, 'https://ai-generator.mix4.ru/contacts'],
  ] as const)('returns expected metadata for %s', (path, title, noIndex, canonical) => {
    const meta = resolveRouteSeo(path);

    expect(meta.title).toBe(title);
    expect(meta.noIndex ?? false).toBe(noIndex);
    expect(meta.canonical).toBe(canonical);
    expect(meta.description).toEqual(expect.any(String));
    expect(meta.description.length).toBeGreaterThan(40);
    expect(meta.image).toBe('https://ai-generator.mix4.ru/logo.png');
  });

  test('provides unique commercial page metadata', () => {
    const pricing = resolveRouteSeo('/pricing');
    const privacy = resolveRouteSeo('/privacy');
    const contacts = resolveRouteSeo('/contacts');

    expect(new Set([pricing.title, privacy.title, contacts.title]).size).toBe(3);
    expect(new Set([pricing.description, privacy.description, contacts.description]).size).toBe(3);
    expect(new Set([pricing.canonical, privacy.canonical, contacts.canonical]).size).toBe(3);
  });
});
