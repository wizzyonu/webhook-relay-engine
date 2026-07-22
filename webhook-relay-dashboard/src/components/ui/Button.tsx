// src/components/ui/Button.tsx
import { cn } from '@/lib/cn';
import { forwardRef } from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary-pill' | 'dark-utility' | 'pearl-capsule';
  size?: 'default' | 'large';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'default', children, ...props }, ref) => {
    const baseStyles = "font-text transition-all duration-150 ease-out active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary-focus";
    
    const variants = {
      primary: cn(
        "bg-primary text-white rounded-pill",
        size === 'large' ? "text-[18px] px-7 py-3.5" : "text-[17px] px-5.5 py-2.75",
        "hover:bg-primary-focus"
      ),
      "secondary-pill": cn(
        "bg-transparent text-primary border border-primary rounded-pill",
        size === 'large' ? "text-[18px] px-7 py-3.5" : "text-[17px] px-5.5 py-2.75",
        "hover:bg-primary/5"
      ),
      "dark-utility": cn(
        "bg-ink text-white text-[14px] rounded-sm px-3.75 py-2",
        "hover:bg-ink/90"
      ),
      "pearl-capsule": cn(
        "bg-surface-pearl text-ink-muted-80 text-[14px] rounded-md px-3.5 py-2",
        "border border-divider-soft hover:bg-white"
      ),
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';