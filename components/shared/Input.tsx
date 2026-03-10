/**
 * Reusable Input Component
 * Matches exact design specifications from HTML designs
 */

'use client';

import { InputHTMLAttributes, ReactNode, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  success?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  helperText?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      success,
      leftIcon,
      rightIcon,
      helperText,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const hasError = !!error;
    const hasSuccess = !!success;

    const baseStyles = 'w-full rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed';
    
    const stateStyles = hasError
      ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20'
      : hasSuccess
      ? 'border-success-500 focus:border-success-500 focus:ring-success-500/20'
      : 'border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-primary/20';

    const paddingStyles = leftIcon && rightIcon
      ? 'pl-10 pr-10'
      : leftIcon
      ? 'pl-10 pr-4'
      : rightIcon
      ? 'pl-4 pr-10'
      : 'px-4';

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            {label}
          </label>
        )}
        
        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              {leftIcon}
            </div>
          )}
          
          <input
            ref={ref}
            className={`${baseStyles} ${stateStyles} ${paddingStyles} py-2 border ${className}`}
            disabled={disabled}
            aria-invalid={hasError}
            aria-describedby={
              error ? `${props.id}-error` : success ? `${props.id}-success` : helperText ? `${props.id}-helper` : undefined
            }
            {...props}
          />
          
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              {rightIcon}
            </div>
          )}
        </div>

        {error && (
          <p id={`${props.id}-error`} className="mt-1 text-xs text-danger-600 dark:text-danger-400">
            {error}
          </p>
        )}

        {success && !error && (
          <p id={`${props.id}-success`} className="mt-1 text-xs text-success-600 dark:text-success-400">
            {success}
          </p>
        )}

        {helperText && !error && !success && (
          <p id={`${props.id}-helper`} className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
