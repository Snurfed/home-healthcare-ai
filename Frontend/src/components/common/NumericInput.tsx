/**
 * NumericInput Component
 *
 * Numeric input with min/max validation and increment/decrement buttons
 */

import { forwardRef, useState, useEffect, type InputHTMLAttributes } from 'react';

interface NumericInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'value'> {
  label?: string;
  error?: string;
  helpText?: string;
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  showButtons?: boolean;
  unit?: string;
}

const NumericInput = forwardRef<HTMLInputElement, NumericInputProps>(
  (
    {
      label,
      error,
      helpText,
      value,
      onChange,
      min,
      max,
      step = 1,
      showButtons = true,
      unit,
      disabled = false,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const [localValue, setLocalValue] = useState<string>(value?.toString() || '');
    const [validationError, setValidationError] = useState<string | null>(null);

    // Sync local value with prop value
    useEffect(() => {
      setLocalValue(value?.toString() || '');
    }, [value]);

    const validate = (num: number): string | null => {
      if (min !== undefined && num < min) {
        return `Value must be at least ${min}`;
      }
      if (max !== undefined && num > max) {
        return `Value must be at most ${max}`;
      }
      return null;
    };

    const handleChange = (newValue: string) => {
      setLocalValue(newValue);

      if (newValue === '' || newValue === '-') {
        onChange(null);
        setValidationError(null);
        return;
      }

      const num = parseFloat(newValue);
      if (isNaN(num)) {
        setValidationError('Please enter a valid number');
        return;
      }

      const valError = validate(num);
      setValidationError(valError);

      if (!valError) {
        onChange(num);
      }
    };

    const handleIncrement = () => {
      const current = value ?? 0;
      const newValue = current + step;
      if (max === undefined || newValue <= max) {
        onChange(newValue);
        setValidationError(null);
      }
    };

    const handleDecrement = () => {
      const current = value ?? 0;
      const newValue = current - step;
      if (min === undefined || newValue >= min) {
        onChange(newValue);
        setValidationError(null);
      }
    };

    const inputId = id || props.name;
    const displayError = error || validationError;
    const errorId = displayError ? `${inputId}-error` : undefined;
    const helpId = helpText ? `${inputId}-help` : undefined;

    // Format range hint
    const rangeHint =
      min !== undefined && max !== undefined
        ? `Range: ${min} - ${max}`
        : min !== undefined
        ? `Minimum: ${min}`
        : max !== undefined
        ? `Maximum: ${max}`
        : null;

    return (
      <div className="form-field">
        {label && (
          <label htmlFor={inputId} className="form-label">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        <div className="flex items-center gap-2">
          {showButtons && (
            <button
              type="button"
              onClick={handleDecrement}
              disabled={disabled || (min !== undefined && (value ?? 0) <= min)}
              className="
                flex items-center justify-center w-10 h-10 rounded-md
                border border-gray-300 bg-white text-gray-600
                hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500
                disabled:opacity-50 disabled:cursor-not-allowed
              "
              aria-label="Decrease value"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
          )}

          <div className="relative flex-1 max-w-[150px]">
            <input
              ref={ref}
              type="text"
              inputMode="decimal"
              id={inputId}
              value={localValue}
              onChange={(e) => handleChange(e.target.value)}
              disabled={disabled}
              aria-invalid={!!displayError}
              aria-describedby={[errorId, helpId].filter(Boolean).join(' ') || undefined}
              className={`
                form-input text-center
                ${displayError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}
                ${unit ? 'pr-12' : ''}
                ${className}
              `}
              {...props}
            />
            {unit && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                {unit}
              </span>
            )}
          </div>

          {showButtons && (
            <button
              type="button"
              onClick={handleIncrement}
              disabled={disabled || (max !== undefined && (value ?? 0) >= max)}
              className="
                flex items-center justify-center w-10 h-10 rounded-md
                border border-gray-300 bg-white text-gray-600
                hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500
                disabled:opacity-50 disabled:cursor-not-allowed
              "
              aria-label="Increase value"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
        </div>

        {rangeHint && !displayError && (
          <p className="text-xs text-gray-400 mt-1">{rangeHint}</p>
        )}

        {displayError && (
          <p id={errorId} className="form-error" role="alert">
            {displayError}
          </p>
        )}

        {helpText && !displayError && (
          <p id={helpId} className="form-help">
            {helpText}
          </p>
        )}
      </div>
    );
  }
);

NumericInput.displayName = 'NumericInput';

export default NumericInput;
