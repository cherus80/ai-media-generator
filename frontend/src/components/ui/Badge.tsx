/**
 * Современный компонент бейджа для статусов и меток
 */

import React from 'react';
import clsx from 'clsx';

export type BadgeVariant = 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
  primary: 'bg-primary-100 text-primary-700 border-primary-200',
  secondary: 'bg-secondary-100 text-secondary-700 border-secondary-200',
  accent: 'bg-accent-100 text-accent-700 border-accent-200',
  success: 'bg-success-100 text-success-700 border-success-200',
  warning: 'bg-warning-100 text-warning-700 border-warning-200',
  danger: 'bg-danger-100 text-danger-700 border-danger-200',
  info: 'bg-primary-50 text-primary-600 border-primary-100',
  neutral: 'bg-dark-100 text-dark-700 border-dark-200',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
  lg: 'px-4 py-1.5 text-base',
};

const dotColorClasses: Record<BadgeVariant, string> = {
  primary: 'bg-primary-500',
  secondary: 'bg-secondary-500',
  accent: 'bg-accent-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  info: 'bg-primary-400',
  neutral: 'bg-dark-400',
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  dot = false,
  icon,
  className,
  children,
}) => {
  const badgeClasses = clsx(
    'inline-flex items-center font-semibold rounded-full border',
    'transition-all duration-150',
    variantClasses[variant],
    sizeClasses[size],
    className
  );

  return (
    <span className={badgeClasses}>
      {dot && (
        <span
          className={clsx(
            'w-2 h-2 rounded-full mr-1.5',
            dotColorClasses[variant]
          )}
        />
      )}
      {icon && <span className="mr-1">{icon}</span>}
      {children}
    </span>
  );
};
