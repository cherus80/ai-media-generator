import { validateRegisterForm } from '../src/utils/passwordValidation';

describe('validateRegisterForm', () => {
  test('allows a simple password during registration', () => {
    const result = validateRegisterForm('user@example.com', 'simple', 'simple');

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  test('still rejects mismatched confirmation', () => {
    const result = validateRegisterForm('user@example.com', 'simple', 'different');

    expect(result.isValid).toBe(false);
    expect(result.errors.confirmPassword).toBe('Пароли не совпадают');
  });
});
