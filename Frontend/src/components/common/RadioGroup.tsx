/**
 * RadioGroup Component
 *
 * Accessible radio button group for single selection
 */

import { forwardRef, type InputHTMLAttributes } from 'react';

interface RadioOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface RadioGroupProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  label?: string;
  error?: string;
  helpText?: string;
  options: RadioOption[];
  value?: string;
  onChange?: (value: string) => void;
  orientation?: 'horizontal' | 'vertical';
}

const RadioGroup = forwardRef<HTMLDivElement, RadioGroupProps>(
  (
    {
      label,
      error,
      helpText,
      options,
      value,
      onChange,
      orientation = 'vertical',
      name,
      required,
      disabled,
      className = '',
    },
    ref
  ) => {
    const groupId = name || 'radio-group';
    const errorId = error ? `${groupId}-error` : undefined;
    const helpId = helpText ? `${groupId}-help` : undefined;

    const handleChange = (optionValue: string) => {
      if (onChange) {
        onChange(optionValue);
      }
    };

    return (
      <div ref={ref} className={`form-field ${className}`}>
        {label && (
          <div className="form-label" id={`${groupId}-label`}>
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </div>
        )}

        <div
          role="radiogroup"
          aria-labelledby={label ? `${groupId}-label` : undefined}
          aria-describedby={
            [errorId, helpId].filter(Boolean).join(' ') || undefined
          }
          aria-invalid={!!error}
          className={`
            ${orientation === 'horizontal' ? 'flex flex-wrap gap-4' : 'space-y-2'}
          `}
        >
          {options.map((option) => {
            const optionId = `${groupId}-${option.value}`;
            const isChecked = value === option.value;
            const isDisabled = disabled || option.disabled;

            return (
              <label
                key={option.value}
                htmlFor={optionId}
                className={`
                  flex items-start cursor-pointer
                  ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <input
                  type="radio"
                  id={optionId}
                  name={name}
                  value={option.value}
                  checked={isChecked}
                  onChange={() => handleChange(option.value)}
                  disabled={isDisabled}
                  className="
                    h-4 w-4 mt-0.5 text-primary-600
                    border-gray-300 focus:ring-primary-500
                    disabled:cursor-not-allowed
                  "
                />
                <div className="ml-3">
                  <span
                    className={`
                      block text-sm font-medium
                      ${isDisabled ? 'text-gray-400' : 'text-gray-700'}
                    `}
                  >
                    {option.label}
                  </span>
                  {option.description && (
                    <span className="block text-sm text-gray-500">
                      {option.description}
                    </span>
                  )}
                </div>
              </label>
            );
          })}
        </div>

        {error && (
          <p id={errorId} className="form-error" role="alert">
            {error}
          </p>
        )}

        {helpText && !error && (
          <p id={helpId} className="form-help">
            {helpText}
          </p>
        )}
      </div>
    );
  }
);

RadioGroup.displayName = 'RadioGroup';

export default RadioGroup;
