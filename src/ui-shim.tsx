// @ts-nocheck
// Thin adapters so the prototype's call-sites use the stock shadcn/ui components (theme styles untouched).
import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card as ShCard, CardHeader as ShHeader, CardTitle, CardDescription, CardContent as ShContent } from '@/components/ui/card'
import { Badge as ShBadge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox as ShCheckbox } from '@/components/ui/checkbox'
import { Progress as ShProgress } from '@/components/ui/progress'
import { Avatar as ShAvatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator as ShSeparator } from '@/components/ui/separator'
import { Dialog as ShDialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Tabs as ShTabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Alert as ShAlert, AlertTitle, AlertDescription } from '@/components/ui/alert'

export { Button, Input, Textarea, Label, CardTitle, RadioGroup, RadioGroupItem, AlertTitle, AlertDescription, ShAlert }
export const CardDesc = CardDescription
export const Separator = () => <ShSeparator />

// Layout only: the app lays its own padding inside cards, so neutralise the stock vertical padding/gap.
export const Card = ({ className, ...p }) => <ShCard className={cn('gap-0 py-0', className)} {...p} />
export const CardHeader = ({ className, ...p }) => <ShHeader className={cn('p-4 pb-2 gap-1', className)} {...p} />
export const CardContent = ({ className, ...p }) => <ShContent className={cn('p-4 pt-2', className)} {...p} />

// warn / ok have no colour in this theme -> outline
export const Badge = ({ variant = 'default', ...p }) => <ShBadge variant={variant === 'warn' || variant === 'ok' ? 'outline' : variant} {...p} />

export const Checkbox = ({ checked, onChange, className, disabled }) =>
  <ShCheckbox checked={!!checked} onCheckedChange={v => onChange(!!v)} disabled={disabled} className={className} />

export const Progress = ({ value }) => <ShProgress value={Math.min(100, value)} />

export const Avatar = ({ name, c = '' }) => (
  <ShAvatar className={c}><AvatarFallback className="text-xs font-medium">{name[0]}</AvatarFallback></ShAvatar>
)

export const Dialog = ({ open, onClose, title, desc, children, footer }) => (
  <ShDialog open={open} onOpenChange={o => { if (!o) onClose() }}>
    <DialogContent className="max-h-[90vh] overflow-auto">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className={desc ? '' : 'sr-only'}>{desc || title}</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">{children}</div>
      {footer && <DialogFooter>{footer}</DialogFooter>}
    </DialogContent>
  </ShDialog>
)

// Stock shadcn Tabs used as a control (no panels)
export const Tabs = ({ tabs, value, onChange }) => (
  <ShTabs value={value} onValueChange={onChange}>
    <TabsList>{tabs.map(([k, l, n]) => <TabsTrigger key={k} value={k}>{l}{n != null && <span className="text-muted-foreground">{n}</span>}</TabsTrigger>)}</TabsList>
  </ShTabs>
)
export const Segmented = ({ opts, value, onChange }) => (
  <ShTabs value={value} onValueChange={onChange}>
    <TabsList>{opts.map(o => <TabsTrigger key={o} value={o}>{o}</TabsTrigger>)}</TabsList>
  </ShTabs>
)
