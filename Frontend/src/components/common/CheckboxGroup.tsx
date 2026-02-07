/**
 * CheckboxGroup Component
 *
 * Multi-select checkbox group with label and error support
 */

import { forwardRef } from 'react';

interface CheckboxOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface CheckboxGroupProps {
  name: string;
  options: CheckboxOption[];
  value: string[];
  onChange: (values: string[]) => void;
  label?: string;
  error?: string;
  helpText?: string;
  disabled?: boolean;
  orientation?: 'horizontal' | 'vertical';
  columns?: 1 | 2 | 3;
}

const CheckboxGroup = forwardRef<HTMLDivElement, CheckboxGroupProps>(
  (
    {
      name,
      options,
      value = [],
      onChange,
      label,
      error,
      helpText,
      disabled = false,
      orientation = 'vertical',
      columns = 1,
    },
    ref
  ) => {
    const handleChange = (optionValue: string, checked: boolean) => {
      if (checked) {
        onChange([...value, optionValue]);
      } else {
        onChange(value.filter((v) => v !== optionValue));
      }
    };

    const gridClass =
      orientation === 'horizontal'
        ? 'flex flex-wrap gap-4'
        : columns === 3
        ? 'grid grid-cols-1 md:grid-cols-3 gap-3'
        : columns === 2
        ? 'grid grid-cols-1 md:grid-cols-2 gap-3'
        : 'space-y-3';

    return (
      <div ref={ref} className="form-field">
        {label && (
          <label className="form-label mb-3 block">
            {label}
          </label>
        )}

        <div className={gridClass} role="group" aria-label={label}>
          {options.map((option) => {
            const isChecked = value.includes(option.value);
            const isDisabled = disabled || option.disabled;

            return (
              <label
                key={option.value}
                className={`
                  relative flex items-start gap-3 p-3 rounded-lg border cursor-pointer
                  transition-colors
                  ${isChecked
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }
                  ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <input
                  type="checkbox"
                  name={name}
                  value={option.value}
                  checked={isChecked}
                  onChange={(e) => handleChange(option.value, e.target.checked)}
                  disabled={isDisabled}
                  className="
                    mt-0.5 h-4 w-4 rounded border-gray-300
                    text-primary-600 focus:ring-primary-500
                    disabled:opacity-50
                  "
                />
                <div className="flex-1 min-w-0">
                  <span
                    className={`
                      block text-sm font-medium
                      ${isChecked ? 'text-primary-900' : 'text-gray-900'}
                    `}
                  >
                    {option.label}
                  </span>
                  {option.description && (
                    <span className="block text-xs text-gray-500 mt-0.5">
                      {option.description}
                    </span>
                  )}
                </div>
              </label>
            );
          })}
        </div>

        {error && (
          <p className="form-error mt-2" role="alert">
            {error}
          </p>
        )}

        {helpText && !error && (
          <p className="form-help mt-2">
            {helpText}
          </p>
        )}
      </div>
    );
  }
);

CheckboxGroup.displayName = 'CheckboxGroup';

export default CheckboxGroup;
