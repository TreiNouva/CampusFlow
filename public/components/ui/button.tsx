import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none',
          size === 'md' ? 'px-4 py-2 text-sm' : 'px-3 py-1.5 text-xs',
          variant === 'primary' && 'bg-navy text-white hover:bg-navy-dark',
          variant === 'secondary' && 'bg-sky text-navy hover:bg-[#dbe6ef]',
          variant === 'ghost' && 'bg-transparent text-navy border border-gray-200 hover:bg-gray-50',
          variant === 'danger' && 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100',
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
