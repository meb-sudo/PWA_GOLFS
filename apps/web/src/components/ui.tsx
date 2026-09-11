import { clsx } from 'clsx';
import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes } from 'react';
import { forwardRef, useState } from 'react';

// --- Bouton ----------------------------------------------------------------

type ButtonVariant = 'primary' | 'accent' | 'ghost' | 'danger' | 'outline';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  loading?: boolean;
  full?: boolean;
  icon?: ReactNode;
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-[var(--color-brand)] text-white active:bg-[var(--color-brand-soft)]',
  accent: 'bg-[var(--color-accent)] text-[var(--color-accent-ink)] active:brightness-95',
  ghost: 'bg-transparent text-[var(--color-ink-soft)] active:bg-[var(--color-surface-alt)]',
  outline: 'bg-[var(--color-surface)] text-[var(--color-ink)] border border-[var(--color-line)] active:bg-[var(--color-surface-alt)]',
  danger: 'bg-[var(--color-danger)] text-white active:brightness-95',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, full, icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-[var(--radius-pill)]',
        'font-medium transition-[transform,filter,background-color] duration-150',
        'active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none',
        // Cible tactile confortable : jamais moins de 44 px de haut.
        size === 'lg' ? 'min-h-13 px-6 text-base' : 'min-h-11 px-5 text-[0.95rem]',
        full && 'w-full',
        variants[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
});

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

// --- Avatar ----------------------------------------------------------------

/**
 * Avatar du membre : ses initiales.
 *
 * Aucune API ne fournit de portrait. Les deux endpoints image lies a une
 * personne (FRMG_GET_BADGE_PHOTO, GET_BADGE_ABONNEMENT_CLUB) renvoient des
 * cartes completes, pas des photos d identite, et strucMembre_Login ne porte
 * aucun champ image.
 *
 * Le parametre src reste prevu pour le jour ou un tel endpoint existera :
 * les initiales sont rendues dessous en permanence, donc une photo qui
 * charge les recouvre et une photo absente ne laisse ni icone cassee ni
 * clignotement.
 */
export function Avatar({
  name, src, className,
}: {
  name: string;
  /** URL de la photo. Absente = initiales seules. */
  src?: string;
  /** Doit porter la taille et la taille de police, ex "size-16 text-xl". */
  className?: string;
}) {
  const [showPhoto, setShowPhoto] = useState(Boolean(src));
  const initials = name
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <span
      className={clsx(
        'relative grid shrink-0 place-items-center overflow-hidden rounded-full',
        'bg-[var(--color-brand)] font-semibold text-white',
        className,
      )}
    >
      <span aria-hidden={showPhoto ? 'true' : undefined}>{initials}</span>
      {src && showPhoto && (
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setShowPhoto(false)}
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </span>
  );
}

// --- Logo de club ----------------------------------------------------------

/**
 * Logo d un club, servi par le BFF depuis images.golfs.ma.
 *
 * Le repli est un simple aplat neutre plutot qu une icone cassee : tous les
 * clubs n ont pas forcement de visuel, et l absence ne doit pas ressembler
 * a une erreur.
 */
export function ClubLogo({
  clubId, name, className,
}: {
  clubId: string;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <span
      className={clsx(
        'grid shrink-0 place-items-center overflow-hidden rounded-xl',
        'bg-[var(--color-surface-alt)] text-[0.7rem] font-semibold text-[var(--color-ink-faint)]',
        className,
      )}
    >
      {failed ? initials : (
        <img
          src={`/api/media/club-logo/${encodeURIComponent(clubId)}`}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="size-full object-contain p-1"
        />
      )}
    </span>
  );
}

// --- Surfaces --------------------------------------------------------------

export function Card({
  className, children, onClick, as,
}: {
  className?: string; children: ReactNode;
  onClick?: () => void; as?: 'div' | 'button';
}) {
  const Tag = as ?? (onClick ? 'button' : 'div');
  return (
    <Tag
      onClick={onClick}
      className={clsx(
        'rounded-[var(--radius-card)] bg-[var(--color-surface)]',
        'border border-[var(--color-line)]',
        onClick && 'w-full text-left transition-transform active:scale-[0.99]',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function SectionTitle({
  eyebrow, title, action,
}: {
  eyebrow?: string; title: string; action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[0.68rem] font-medium uppercase tracking-[0.14em] text-[var(--color-ink-faint)]">
            {eyebrow}
          </p>
        )}
        <h2 className="truncate text-[1.35rem] font-semibold tracking-tight">{title}</h2>
      </div>
      {action}
    </div>
  );
}

// --- Champs ----------------------------------------------------------------

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, hint, id, className, ...rest }, ref,
) {
  const inputId = id ?? `f-${label.replace(/\s+/g, '-').toLowerCase()}`;
  const describedBy = error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-[var(--color-ink-soft)]">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={clsx(
          'min-h-12 rounded-xl border bg-[var(--color-surface)] px-4',
          'transition-colors placeholder:text-[var(--color-ink-faint)]',
          error ? 'border-[var(--color-danger)]' : 'border-[var(--color-line)]',
          className,
        )}
        {...rest}
      />
      {error && (
        <p id={`${inputId}-err`} role="alert" className="text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={`${inputId}-hint`} className="text-sm text-[var(--color-ink-faint)]">{hint}</p>
      )}
    </div>
  );
});

/** Groupe de choix exclusifs, style segmenté. */
export function Segmented<T extends string | number>({
  options, value, onChange, label, disabled,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  label: string;
  /** Grise le controle : le choix est impose, non modifiable. */
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={clsx(
        'flex gap-1 rounded-[var(--radius-pill)] bg-[var(--color-surface-alt)] p-1',
        disabled && 'opacity-60',
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={clsx(
              'min-h-10 flex-1 rounded-[var(--radius-pill)] px-3 text-sm font-medium transition-colors',
              active
                ? 'bg-[var(--color-surface)] text-[var(--color-ink)] shadow-sm'
                : 'text-[var(--color-ink-soft)]',
              disabled && 'cursor-not-allowed',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// --- Etats -----------------------------------------------------------------

export function Badge({
  children, tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'positive' | 'warning' | 'danger' | 'accent';
}) {
  const tones = {
    neutral: 'bg-[var(--color-surface-alt)] text-[var(--color-ink-soft)]',
    positive: 'bg-[var(--color-positive)]/12 text-[var(--color-positive)]',
    warning: 'bg-[var(--color-warning)]/12 text-[var(--color-warning)]',
    danger: 'bg-[var(--color-danger)]/12 text-[var(--color-danger)]',
    accent: 'bg-[var(--color-accent)] text-[var(--color-accent-ink)]',
  };
  return (
    <span className={clsx(
      'inline-flex items-center rounded-[var(--radius-pill)] px-2.5 py-1',
      'text-[0.7rem] font-semibold uppercase tracking-wide',
      tones[tone],
    )}>
      {children}
    </span>
  );
}

export function EmptyState({
  title, description, action, icon,
}: {
  title: string; description?: string; action?: ReactNode; icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-[var(--color-line)] px-6 py-12 text-center">
      {icon && <div className="text-[var(--color-ink-faint)]">{icon}</div>}
      <p className="font-medium">{title}</p>
      {description && (
        <p className="max-w-[38ch] text-sm text-[var(--color-ink-soft)]">{description}</p>
      )}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-[var(--radius-card)] border border-[var(--color-danger)]/25 bg-[var(--color-danger)]/6 p-4"
    >
      <p className="text-sm text-[var(--color-ink)]">{message}</p>
      {onRetry && (
        <Button variant="outline" size="md" onClick={onRetry}>Réessayer</Button>
      )}
    </div>
  );
}

/** Bloc de chargement, calé sur la hauteur du contenu attendu. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={clsx('animate-pulse rounded-xl bg-[var(--color-surface-alt)]', className)}
    />
  );
}

export function SkeletonList({ rows = 3, height = 'h-24' }: { rows?: number; height?: string }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={height} />
      ))}
    </div>
  );
}
