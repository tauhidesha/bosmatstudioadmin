'use client';

import { Button as HeroButton, ButtonProps as HeroButtonProps } from '@heroui/react';
import { ReactNode } from 'react';

interface ButtonProps extends Omit<HeroButtonProps, 'variant' | 'size'> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  ...props
}: ButtonProps) {
  
  // Mapping custom variants to HeroUI variants/colors
  const getHeroProps = () => {
    switch (variant) {
      case 'primary':
        return { 
          color: 'primary' as const, 
          variant: 'solid' as const,
          className: `font-bold text-white shadow-lg shadow-primary/25 ${className}` 
        };
      case 'secondary':
        return { 
          variant: 'light' as const,
          className: `text-slate-600 font-semibold hover:text-slate-900 ${className}` 
        };
      case 'danger':
        return { 
          color: 'danger' as const, 
          variant: 'solid' as const,
          className: `shadow-lg shadow-danger/25 text-white ${className}` 
        };
      case 'success':
        return { 
          color: 'success' as const, 
          variant: 'solid' as const,
          className: `shadow-lg shadow-success/25 text-white ${className}` 
        };
      case 'icon':
        return { 
          variant: 'flat' as const,
          isIconOnly: true,
          className: `bg-slate-100 text-slate-600 hover:bg-slate-200 ${className}` 
        };
      default:
        return { className };
    }
  };

  const heroProps = getHeroProps();

  return (
    <HeroButton
      size={size}
      isLoading={isLoading}
      radius="lg"
      disableAnimation={false}
      {...heroProps}
      {...props}
    >
      {children}
    </HeroButton>
  );
}
