import { createContext, use, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Toaster } from '@/components/shadcn/sonner';

type ToastTone = 'success' | 'error' | 'info';

interface ToastApi {
  show: (t: { tone: ToastTone; title: string; description?: string }) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
}

const api: ToastApi = {
  show: ({ tone, title, description }) =>
    toast[tone](title, { description, duration: tone === 'error' ? 8000 : 5000 }),
  success: (title, description) => toast.success(title, { description }),
  error: (title, description) => toast.error(title, { description, duration: 8000 }),
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = use(ToastContext);
  if (!ctx) throw new Error('useToast() used outside <ToastProvider>');
  return ctx;
}

/** Sonner toasts (shadcn): stacked, swipe to dismiss, close button, announced to screen readers. */
export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <ToastContext value={api}>
      {children}
      <Toaster position="bottom-right" closeButton richColors={false} />
    </ToastContext>
  );
}
