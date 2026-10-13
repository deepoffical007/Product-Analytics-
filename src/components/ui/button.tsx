import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
        outline: 'border border-input bg-card shadow-sm hover:bg-muted hover:text-foreground',
        ghost: 'hover:bg-muted hover:text-foreground',
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        success: 'bg-success text-white shadow-sm hover:bg-success/90',
        link: 'text-primary underline-offset-4 hover:underline px-0 h-auto',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-9 px-4',
        lg: 'h-10 px-5',
        icon: 'h-9 w-9',
        'icon-sm': 'h-8 w-8',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, loading, disabled, children, type = 'button', ...props }, ref) => (
  <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
    {loading && <Loader2 className="animate-spin" aria-hidden />}
    {children}
  </button>
));
Button.displayName = 'Button';
