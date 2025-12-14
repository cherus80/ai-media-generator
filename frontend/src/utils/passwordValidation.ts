/**
 * Password validation utilities
 */

import type { PasswordStrength } from '../types/auth';

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check password strength
 */
export function checkPasswordStrength(password: string): PasswordStrength {
  const feedback: string[] = [];
  let score = 0;

  // Check length
  if (password.length < 8) {
    feedback.push('Password must be at least 8 characters long');
    return { score: 0, feedback, isStrong: false };
  }
  score++;

  // Check for uppercase
  if (/[A-Z]/.test(password)) {
    score++;
  } else {
    feedback.push('Add at least one uppercase letter');
  }

  // Check for lowercase
  if (/[a-z]/.test(password)) {
    score++;
  } else {
    feedback.push('Add at least one lowercase letter');
  }

  // Check for numbers
  if (/\d/.test(password)) {
    score++;
  } else {
    feedback.push('Add at least one number');
  }

  // Check for special characters
  if (/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password)) {
    score++;
  } else {
    feedback.push('Добавьте хотя бы один специальный символ (!@#$%^&*()_+-=[]{}|;:,.<>?)');
  }

  // Check for very strong passwords (length > 12)
  if (password.length >= 12) {
    score = Math.min(score + 1, 5);
  }

  const isStrong = score >= 4;

  return {
    score: Math.min(score, 4), // Cap at 4 for UI display
    feedback,
    isStrong,
  };
}

/**
 * Get password strength label
 */
export function getPasswordStrengthLabel(score: number): string {
  switch (score) {
    case 0:
      return 'Very Weak';
    case 1:
      return 'Weak';
    case 2:
      return 'Fair';
    case 3:
      return 'Good';
    case 4:
      return 'Strong';
    default:
      return 'Unknown';
  }
}

/**
 * Get password strength color
 */
export function getPasswordStrengthColor(score: number): string {
  switch (score) {
    case 0:
      return 'bg-red-500';
    case 1:
      return 'bg-orange-500';
    case 2:
      return 'bg-yellow-500';
    case 3:
      return 'bg-blue-500';
    case 4:
      return 'bg-green-500';
    default:
      return 'bg-gray-500';
  }
}

/**
 * Validate password meets minimum requirements
 */
export function validatePassword(password: string): { isValid: boolean; error?: string } {
  if (password.length < 8) {
    return {
      isValid: false,
      error: 'Password must be at least 8 characters long',
    };
  }

  if (!/[A-Z]/.test(password)) {
    return {
      isValid: false,
      error: 'Password must contain at least one uppercase letter',
    };
  }

  if (!/[a-z]/.test(password)) {
    return {
      isValid: false,
      error: 'Password must contain at least one lowercase letter',
    };
  }

  if (!/\d/.test(password)) {
    return {
      isValid: false,
      error: 'Password must contain at least one number',
    };
  }

  if (!/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password)) {
    return {
      isValid: false,
      error: 'Пароль должен содержать хотя бы один специальный символ (!@#$%^&*()_+-=[]{}|;:,.<>?)',
    };
  }

  return { isValid: true };
}

/**
 * Validate form data
 */
export function validateLoginForm(email: string, password: string): {
  isValid: boolean;
  errors: { email?: string; password?: string };
} {
  const errors: { email?: string; password?: string } = {};

  if (!email) {
    errors.email = 'Email is required';
  } else if (!isValidEmail(email)) {
    errors.email = 'Invalid email format';
  }

  if (!password) {
    errors.password = 'Password is required';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validate registration form
 */
export function validateRegisterForm(
  email: string,
  password: string,
  confirmPassword: string
): {
  isValid: boolean;
  errors: { email?: string; password?: string; confirmPassword?: string };
} {
  const errors: { email?: string; password?: string; confirmPassword?: string } = {};

  if (!email) {
    errors.email = 'Email is required';
  } else if (!isValidEmail(email)) {
    errors.email = 'Invalid email format';
  }

  if (!password) {
    errors.password = 'Password is required';
  } else {
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      errors.password = passwordValidation.error;
    }
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'Please confirm your password';
  } else if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
