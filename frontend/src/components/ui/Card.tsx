/**
 * Современный компонент карточки с различными эффектами
 */

import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

export type CardVariant = 'default' | 'glass' | 'gradient' | 'bordered' | 'elevated';

interface CardProps {
  variant?: CardVariant;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

const variantClasses: Record<CardVariant, string> = {
  default: 'bg-white border border-slate-100 shadow-soft',
  glass: 'glass', /* Используем класс из index.css для единого стиля */
  gradient: 'bg-gradient-to-br from-primary-50/50 to-secondary-50/50 border border-primary-100 shadow-medium',
  bordered: 'bg-white border-2 border-primary-200',
  elevated: 'bg-white shadow-large',
};

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
  xl: 'p-8',
};

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  hover = false,
  padding = 'md',
  className,
  children,
  onClick,
}) => {
  const cardClasses = clsx(
    'rounded-2xl transition-all duration-200',
    variantClasses[variant],
    paddingClasses[padding],
    hover && 'cursor-pointer hover:-translate-y-1 hover:shadow-xl',
    onClick && 'cursor-pointer',
    className
  );

  const CardComponent = onClick || hover ? motion.div : 'div';
  const motionProps = onClick || hover
    ? {
        whileHover: { y: -4 },
        whileTap: { scale: 0.98 },
      }
    : {};

  return (
    <CardComponent
      className={cardClasses}
      onClick={onClick}
      {...motionProps}
    >
      {children}
    </CardComponent>
  );
};
