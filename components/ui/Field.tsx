import React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn, field, input } from './styles';

let autoId = 0;
const useFieldId = (provided?: string) => {
  const [generated] = React.useState(() => `fld-${++autoId}`);
  return provided ?? generated;
};

/* -------------------------------------------------------------------------- */
/*  Field — etiqueta + control + ayuda/error                                   */
/* -------------------------------------------------------------------------- */

export interface FieldProps {
  label: string;
  /** Oculta la etiqueta visualmente pero la mantiene para lectores de pantalla. */
  hideLabel?: boolean;
  required?: boolean;
  hint?: string;
  error?: string;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Envoltorio de campo de formulario.
 * El error se renderiza junto al campo (no al principio del formulario) y se
 * anuncia con `role="alert"`.
 */
export const Field: React.FC<FieldProps> = ({
  label,
  hideLabel = false,
  required,
  hint,
  error,
  htmlFor,
  className,
  children,
}) => (
  <div className={cn(field.root, className)}>
    <label htmlFor={htmlFor} className={cn(field.label, hideLabel && 'sr-only')}>
      {label}
      {required && <span className={field.required} aria-hidden="true">*</span>}
    </label>

    {children}

    {error ? (
      <p className={field.error} role="alert">
        <AlertCircle size={13} className="shrink-0" aria-hidden="true" />
        {error}
      </p>
    ) : (
      hint && <p className={field.hint}>{hint}</p>
    )}
  </div>
);

/* -------------------------------------------------------------------------- */
/*  Input                                                                      */
/* -------------------------------------------------------------------------- */

type InputSize = keyof typeof input.size;

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  hideLabel?: boolean;
  hint?: string;
  error?: string;
  inputSize?: InputSize;
  /** Alinea a la derecha con cifras tabulares. Para precios y cantidades. */
  numeric?: boolean;
  /** Icono decorativo dentro del control, a la izquierda. */
  leadingIcon?: React.ReactNode;
  wrapperClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      hideLabel,
      hint,
      error,
      inputSize = 'md',
      numeric = false,
      leadingIcon,
      wrapperClassName,
      className,
      id,
      required,
      ...props
    },
    ref,
  ) => {
    const fieldId = useFieldId(id);

    const control = (
      <div className="relative">
        {leadingIcon && (
          <span className={input.leadingIcon} aria-hidden="true">
            {leadingIcon}
          </span>
        )}
        <input
          ref={ref}
          id={fieldId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${fieldId}-desc` : undefined}
          className={cn(
            input.base,
            input.size[inputSize],
            numeric && input.numeric,
            leadingIcon && input.withLeadingIcon,
            error && input.invalid,
            className,
          )}
          {...props}
        />
      </div>
    );

    if (!label) return control;

    return (
      <Field
        label={label}
        hideLabel={hideLabel}
        required={required}
        hint={hint}
        error={error}
        htmlFor={fieldId}
        className={wrapperClassName}
      >
        {control}
      </Field>
    );
  },
);

Input.displayName = 'Input';

/* -------------------------------------------------------------------------- */
/*  Select                                                                     */
/* -------------------------------------------------------------------------- */

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  hint?: string;
  error?: string;
  inputSize?: InputSize;
  wrapperClassName?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    { label, hint, error, inputSize = 'md', wrapperClassName, className, id, required, children, ...props },
    ref,
  ) => {
    const fieldId = useFieldId(id);

    const control = (
      <select
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn(input.select, input.size[inputSize], error && input.invalid, className)}
        {...props}
      >
        {children}
      </select>
    );

    if (!label) return control;

    return (
      <Field
        label={label}
        required={required}
        hint={hint}
        error={error}
        htmlFor={fieldId}
        className={wrapperClassName}
      >
        {control}
      </Field>
    );
  },
);

Select.displayName = 'Select';

/* -------------------------------------------------------------------------- */
/*  Textarea                                                                   */
/* -------------------------------------------------------------------------- */

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, wrapperClassName, className, id, required, ...props }, ref) => {
    const fieldId = useFieldId(id);

    const control = (
      <textarea
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn(input.textarea, error && input.invalid, className)}
        {...props}
      />
    );

    if (!label) return control;

    return (
      <Field
        label={label}
        required={required}
        hint={hint}
        error={error}
        htmlFor={fieldId}
        className={wrapperClassName}
      >
        {control}
      </Field>
    );
  },
);

Textarea.displayName = 'Textarea';
