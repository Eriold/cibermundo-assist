import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';

type ClassValue = false | null | string | undefined;

type ButtonVariant = 'danger' | 'primary' | 'secondary' | 'subtle' | 'success';
type IconButtonVariant = 'danger' | 'neutral' | 'primary' | 'success';
type AlertTone = 'error' | 'info' | 'success' | 'warning';
type StatTone = 'default' | 'primary' | 'success' | 'warning';

export const cn = (...values: ClassValue[]) => values.filter(Boolean).join(' ');

const buttonBase =
  'inline-flex touch-manipulation items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-50 dark:focus-visible:ring-offset-[#181811]';

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-neutral-dark hover:bg-primary-dark',
  secondary:
    'bg-gray-100 text-dark-text hover:bg-gray-200 dark:bg-white/5 dark:text-white dark:hover:bg-white/10',
  subtle:
    'border border-gray-200/80 bg-white text-dark-text hover:border-gray-300 hover:bg-gray-50 dark:border-white/10 dark:bg-[#232218] dark:text-white dark:hover:bg-[#2b2a1f]',
  danger: 'bg-red-500 text-white hover:bg-red-600',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
};

const iconButtonVariants: Record<IconButtonVariant, string> = {
  neutral:
    'border border-gray-200/80 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-dark-text dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white',
  primary: 'bg-primary/12 text-primary hover:bg-primary/18 dark:bg-primary/15 dark:hover:bg-primary/20',
  danger: 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20',
  success:
    'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20',
};

const alertStyles: Record<AlertTone, string> = {
  error: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300',
  info: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300',
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
  warning:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200',
};

const statStyles: Record<StatTone, string> = {
  default:
    'border-gray-200/80 bg-white text-dark-text dark:border-white/10 dark:bg-[#232218] dark:text-white',
  primary: 'border-primary/15 bg-primary/10 text-dark-text dark:border-primary/15 dark:bg-primary/10 dark:text-white',
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200',
  warning:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200',
};

export const fieldClassName =
  'w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-dark-text transition-colors placeholder:text-gray-400 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 dark:border-white/10 dark:bg-[#232218] dark:text-white dark:placeholder:text-gray-500';

export const selectClassName = cn(fieldClassName, 'cursor-pointer pr-10');

export const checkboxCardClassName =
  'flex w-full items-start gap-3 rounded-2xl border border-gray-200/80 bg-white px-4 py-3 text-left transition-colors hover:border-primary/30 hover:bg-gray-50 dark:border-white/10 dark:bg-[#232218] dark:hover:bg-[#2b2a1f]';

export const surfaceClassName =
  'rounded-[28px] border border-gray-200/80 bg-white shadow-[0_20px_60px_-40px_rgba(24,24,17,0.35)] dark:border-white/10 dark:bg-[#181811]';

interface AdminSectionProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
}

export const AdminSection = ({ children, className, ...props }: AdminSectionProps) => (
  <section className={cn('flex min-h-0 flex-1 flex-col gap-5', className)} {...props}>
    {children}
  </section>
);

interface AdminHeaderProps {
  actions?: ReactNode;
  children?: ReactNode;
  description: string;
  eyebrow?: string;
  title: string;
}

export const AdminHeader = ({
  actions,
  children,
  description,
  eyebrow,
  title,
}: AdminHeaderProps) => (
  <header className={cn(surfaceClassName, 'overflow-hidden px-5 py-5 sm:px-6 sm:py-6')}>
    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
      <div className="max-w-3xl space-y-2">
        {eyebrow ? (
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
            {eyebrow}
          </p>
        ) : null}
        <div className="space-y-2">
          <h1 className="text-2xl font-black tracking-tight text-dark-text text-balance dark:text-white sm:text-[2rem]">
            {title}
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300 sm:text-[15px]">
            {description}
          </p>
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
    {children ? <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div> : null}
  </header>
);

interface StatCardProps {
  icon: string;
  label: string;
  tone?: StatTone;
  value: ReactNode;
}

export const StatCard = ({ icon, label, tone = 'default', value }: StatCardProps) => (
  <div className={cn('rounded-3xl border px-4 py-4', statStyles[tone])}>
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-1">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-current/60">{label}</p>
        <p className="text-xl font-black tracking-tight">{value}</p>
      </div>
      <div className="flex size-11 items-center justify-center rounded-2xl bg-white/70 text-current shadow-sm dark:bg-white/5">
        <MaterialIcon className="text-[22px]" name={icon} />
      </div>
    </div>
  </div>
);

interface SurfaceCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const SurfaceCard = ({ children, className, ...props }: SurfaceCardProps) => (
  <div className={cn(surfaceClassName, className)} {...props}>
    {children}
  </div>
);

interface TableCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const TableCard = ({ children, className, ...props }: TableCardProps) => (
  <div className={cn(surfaceClassName, 'flex min-h-0 flex-1 flex-col overflow-hidden', className)} {...props}>
    {children}
  </div>
);

interface InlineAlertProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  icon?: string;
  tone?: AlertTone;
}

export const InlineAlert = ({
  children,
  className,
  icon = 'error',
  tone = 'error',
  ...props
}: InlineAlertProps) => (
  <div
    aria-live="polite"
    className={cn(
      'flex items-start gap-3 rounded-3xl border px-4 py-4 text-sm font-bold shadow-sm',
      alertStyles[tone],
      className,
    )}
    role="status"
    {...props}
  >
    <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-2xl bg-white/60 dark:bg-white/5">
      <MaterialIcon className="text-[20px]" name={icon} />
    </div>
    <div className="min-w-0 flex-1">{children}</div>
  </div>
);

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: string;
  iconClassName?: string;
  variant?: ButtonVariant;
}

export const ActionButton = ({
  children,
  className,
  icon,
  iconClassName,
  type = 'button',
  variant = 'secondary',
  ...props
}: ActionButtonProps) => (
  <button className={cn(buttonBase, buttonVariants[variant], className)} type={type} {...props}>
    {icon ? <MaterialIcon className={cn('text-[18px]', iconClassName)} name={icon} /> : null}
    {children}
  </button>
);

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  label: string;
  variant?: IconButtonVariant;
}

export const IconButton = ({
  className,
  icon,
  label,
  type = 'button',
  variant = 'neutral',
  ...props
}: IconButtonProps) => (
  <button
    aria-label={label}
    className={cn(
      'inline-flex size-10 touch-manipulation items-center justify-center rounded-2xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-50 dark:focus-visible:ring-offset-[#181811]',
      iconButtonVariants[variant],
      className,
    )}
    title={label}
    type={type}
    {...props}
  >
    <MaterialIcon className="text-[18px]" name={icon} />
  </button>
);

interface SegmentedOption {
  label: string;
  value: string;
}

interface SegmentedControlProps {
  ariaLabel: string;
  onChange: (value: string) => void;
  options: SegmentedOption[];
  value: string;
}

export const SegmentedControl = ({
  ariaLabel,
  onChange,
  options,
  value,
}: SegmentedControlProps) => (
  <div
    aria-label={ariaLabel}
    className="inline-flex w-full flex-wrap gap-2 rounded-3xl border border-gray-200/80 bg-gray-50/80 p-2 dark:border-white/10 dark:bg-[#232218]"
    role="tablist"
  >
    {options.map((option) => {
      const active = option.value === value;

      return (
        <button
          aria-selected={active}
          className={cn(
            'min-w-[9rem] flex-1 rounded-2xl px-4 py-3 text-left text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
            active
              ? 'bg-white text-dark-text shadow-sm dark:bg-[#2c2b1f] dark:text-white'
              : 'text-gray-500 hover:bg-white/70 hover:text-dark-text dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white',
          )}
          key={option.value}
          onClick={() => onChange(option.value)}
          role="tab"
          type="button"
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

interface TableStatusRowProps {
  colSpan: number;
  description?: string;
  icon: string;
  iconClassName?: string;
  title: string;
}

export const TableStatusRow = ({
  colSpan,
  description,
  icon,
  iconClassName,
  title,
}: TableStatusRowProps) => (
  <tr>
    <td className="px-6 py-16" colSpan={colSpan}>
      <div className="flex flex-col items-center justify-center gap-3 text-center text-gray-500 dark:text-gray-400">
        <div className="flex size-16 items-center justify-center rounded-[24px] bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-300">
          <MaterialIcon className={cn('text-3xl', iconClassName)} name={icon} />
        </div>
        <div className="space-y-1">
          <p className="text-base font-black text-dark-text dark:text-white">{title}</p>
          {description ? <p className="max-w-md text-sm leading-6">{description}</p> : null}
        </div>
      </div>
    </td>
  </tr>
);

interface DialogProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  width?: 'lg' | 'md' | 'sm';
}

const dialogWidths = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
};

export const Dialog = ({ children, className, width = 'md', ...props }: DialogProps) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
    <div
      aria-modal="true"
      className={cn(
        surfaceClassName,
        'max-h-[90vh] w-full overflow-hidden overscroll-contain',
        dialogWidths[width],
        className,
      )}
      role="dialog"
      {...props}
    >
      {children}
    </div>
  </div>
);

interface DialogHeaderProps {
  icon?: string;
  onClose?: () => void;
  subtitle?: string;
  title: string;
}

export const DialogHeader = ({ icon, onClose, subtitle, title }: DialogHeaderProps) => (
  <div className="flex items-start justify-between gap-4 border-b border-gray-200/80 bg-gray-50/80 px-5 py-5 dark:border-white/10 dark:bg-white/5 sm:px-6">
    <div className="flex items-start gap-3">
      {icon ? (
        <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <MaterialIcon className="text-[22px]" name={icon} />
        </div>
      ) : null}
      <div className="space-y-1">
        <h2 className="text-xl font-black tracking-tight text-dark-text dark:text-white">{title}</h2>
        {subtitle ? <p className="text-sm leading-6 text-gray-500 dark:text-gray-400">{subtitle}</p> : null}
      </div>
    </div>
    {onClose ? <IconButton icon="close" label="Cerrar dialogo" onClick={onClose} /> : null}
  </div>
);

interface DialogFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const DialogFooter = ({ children, className, ...props }: DialogFooterProps) => (
  <div
    className={cn(
      'flex flex-col-reverse gap-3 border-t border-gray-200/80 bg-gray-50/80 px-5 py-4 dark:border-white/10 dark:bg-white/5 sm:flex-row sm:justify-end sm:px-6',
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

interface ConfirmDialogProps {
  cancelLabel?: string;
  confirmLabel: string;
  description: ReactNode;
  icon?: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  tone?: 'danger' | 'warning';
}

export const ConfirmDialog = ({
  cancelLabel = 'Cancelar',
  confirmLabel,
  description,
  icon = 'warning',
  loading = false,
  onCancel,
  onConfirm,
  title,
  tone = 'danger',
}: ConfirmDialogProps) => (
  <Dialog width="sm">
    <div className="px-6 py-6 text-center">
      <div
        className={cn(
          'mx-auto mb-4 flex size-16 items-center justify-center rounded-[24px]',
          tone === 'danger'
            ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'
            : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
        )}
      >
        <MaterialIcon className="text-3xl" name={icon} />
      </div>
      <h2 className="text-xl font-black tracking-tight text-dark-text dark:text-white">{title}</h2>
      <div className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">{description}</div>
    </div>
    <DialogFooter className="border-t-0 bg-transparent">
      <ActionButton disabled={loading} onClick={onCancel} variant="secondary">
        {cancelLabel}
      </ActionButton>
      <ActionButton disabled={loading} onClick={onConfirm} variant={tone === 'danger' ? 'danger' : 'success'}>
        {loading ? 'Procesando...' : confirmLabel}
      </ActionButton>
    </DialogFooter>
  </Dialog>
);

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
}

export const TextField = ({ className, label, name, ...props }: FieldProps) => (
  <div className="space-y-2">
    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300" htmlFor={name}>
      {label}
    </label>
    <input className={cn(fieldClassName, className)} id={name} name={name} {...props} />
  </div>
);

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  children: ReactNode;
  label: string;
  name: string;
}

export const SelectField = ({ children, className, label, name, ...props }: SelectFieldProps) => (
  <div className="space-y-2">
    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300" htmlFor={name}>
      {label}
    </label>
    <select className={cn(selectClassName, className)} id={name} name={name} {...props}>
      {children}
    </select>
  </div>
);

interface MaterialIconProps {
  className?: string;
  name: string;
}

export const MaterialIcon = ({ className, name }: MaterialIconProps) => (
  <span aria-hidden="true" className={cn('material-symbols-outlined', className)}>
    {name}
  </span>
);
