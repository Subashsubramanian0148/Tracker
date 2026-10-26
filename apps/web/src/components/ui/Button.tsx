import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/shadcn/button';
import { Hint } from './Tooltip';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
export type ButtonSize = 'sm' | 'md';

// App variant names → shadcn button variants.
const VARIANT = {
  primary: 'default',
  secondary: 'secondary',
  ghost: 'ghost',
  outline: 'outline',
  danger: 'destructive',
} as const;
const SIZE = { sm: 'sm', md: 'default' } as const;

export function buttonClasses(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md') {
  return cn(buttonVariants({ variant: VARIANT[variant], size: SIZE[size] }), 'cursor-pointer');
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      data-slot="button"
      className={cn(buttonClasses(variant, size), className)}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
}

export function ButtonLink({
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={cn(buttonClasses(variant, size), className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
}

/** Icon-only button; `label` becomes the accessible name. */
export function IconButton({
  label,
  className,
  children,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <Hint content={label}>
      <button
        type={type}
        aria-label={label}
        className={cn(
          buttonVariants({ variant: 'ghost', size: 'icon' }),
          'cursor-pointer text-muted-foreground',
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    </Hint>
  );
}

/** Secondary action in the top bar (Export, Sync now). */
export function GradientButton({
  className,
  children,
  icon,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant: 'outline' }), 'cursor-pointer', className)}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
