import { Search } from 'lucide-react';
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/shadcn/input';
import { Label } from '@/components/shadcn/label';
import { Textarea } from '@/components/shadcn/textarea';

interface FieldWrapperProps {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
}

export function FieldWrapper({ id, label, error, hint, required, children }: FieldWrapperProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden>
            {' '}
            *
          </span>
        ) : null}
      </Label>
      {children}
      {error || hint ? (
        <div className="flex items-start justify-between gap-3 text-xs">
          {error ? (
            <p id={`${id}-error`} className="text-destructive">
              {error}
            </p>
          ) : (
            <span />
          )}
          {hint ? (
            <span id={`${id}-hint`} className="text-muted-foreground">
              {hint}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function TextInput({
  invalid,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <Input aria-invalid={invalid || undefined} className={cn('bg-card', className)} {...rest} />
  );
}

export function TextArea({
  invalid,
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <Textarea
      aria-invalid={invalid || undefined}
      className={cn('min-h-28 bg-card', className)}
      {...rest}
    />
  );
}

/** Search field with a leading icon. */
export function SearchInput({
  label,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div className={cn('relative', className)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        aria-label={label}
        placeholder="Search…"
        className="bg-card pl-9"
        {...rest}
      />
    </div>
  );
}
