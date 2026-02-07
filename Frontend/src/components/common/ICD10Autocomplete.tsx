/**
 * ICD10Autocomplete Component
 *
 * Autocomplete input for ICD-10 diagnosis codes with search
 */

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';

// Common ICD-10 codes for home health care
const ICD10_CODES = [
  // Heart conditions
  { code: 'I50.9', description: 'Heart failure, unspecified' },
  { code: 'I50.22', description: 'Chronic systolic heart failure' },
  { code: 'I50.32', description: 'Chronic diastolic heart failure' },
  { code: 'I50.42', description: 'Chronic combined systolic and diastolic heart failure' },
  { code: 'I10', description: 'Essential (primary) hypertension' },
  { code: 'I25.10', description: 'Atherosclerotic heart disease of native coronary artery' },
  { code: 'I48.91', description: 'Atrial fibrillation, unspecified' },

  // Diabetes
  { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications' },
  { code: 'E11.65', description: 'Type 2 diabetes mellitus with hyperglycemia' },
  { code: 'E11.21', description: 'Type 2 diabetes mellitus with diabetic nephropathy' },
  { code: 'E11.40', description: 'Type 2 diabetes mellitus with diabetic neuropathy' },
  { code: 'E11.621', description: 'Type 2 diabetes mellitus with foot ulcer' },

  // Respiratory
  { code: 'J44.1', description: 'Chronic obstructive pulmonary disease with acute exacerbation' },
  { code: 'J44.9', description: 'Chronic obstructive pulmonary disease, unspecified' },
  { code: 'J18.9', description: 'Pneumonia, unspecified organism' },
  { code: 'J96.11', description: 'Chronic respiratory failure with hypoxia' },

  // Musculoskeletal
  { code: 'M17.11', description: 'Primary osteoarthritis, right knee' },
  { code: 'M17.12', description: 'Primary osteoarthritis, left knee' },
  { code: 'M16.11', description: 'Primary osteoarthritis, right hip' },
  { code: 'M16.12', description: 'Primary osteoarthritis, left hip' },
  { code: 'M54.5', description: 'Low back pain' },

  // Neurological
  { code: 'I63.9', description: 'Cerebral infarction, unspecified' },
  { code: 'G20', description: 'Parkinson\'s disease' },
  { code: 'G30.9', description: 'Alzheimer\'s disease, unspecified' },
  { code: 'G89.29', description: 'Other chronic pain' },

  // Wounds and skin
  { code: 'L89.90', description: 'Pressure ulcer of unspecified site, unspecified stage' },
  { code: 'L89.150', description: 'Pressure ulcer of sacral region, unstageable' },
  { code: 'L89.310', description: 'Pressure ulcer of right buttock, unstageable' },
  { code: 'L97.519', description: 'Non-pressure chronic ulcer of other part of right foot' },

  // Renal
  { code: 'N18.3', description: 'Chronic kidney disease, stage 3' },
  { code: 'N18.4', description: 'Chronic kidney disease, stage 4' },
  { code: 'N18.5', description: 'Chronic kidney disease, stage 5' },

  // Other common
  { code: 'Z96.641', description: 'Presence of right artificial hip joint' },
  { code: 'Z96.642', description: 'Presence of left artificial hip joint' },
  { code: 'Z96.651', description: 'Presence of right artificial knee joint' },
  { code: 'Z96.652', description: 'Presence of left artificial knee joint' },
  { code: 'Z87.39', description: 'Personal history of other diseases of musculoskeletal system' },
  { code: 'R26.81', description: 'Unsteadiness on feet' },
  { code: 'R26.89', description: 'Other abnormalities of gait and mobility' },
  { code: 'Z74.01', description: 'Bed confinement status' },
  { code: 'Z91.81', description: 'History of falling' },
];

interface ICD10Option {
  code: string;
  description: string;
}

interface ICD10AutocompleteProps {
  name: string;
  value: string;
  onChange: (value: string, description?: string) => void;
  label?: string;
  error?: string;
  helpText?: string;
  disabled?: boolean;
  placeholder?: string;
  required?: boolean;
}

export default function ICD10Autocomplete({
  name,
  value,
  onChange,
  label,
  error,
  helpText,
  disabled = false,
  placeholder = 'Search ICD-10 code or description...',
  required = false,
}: ICD10AutocompleteProps) {
  const [inputValue, setInputValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<ICD10Option[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [selectedDescription, setSelectedDescription] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Search for matching codes
  const searchCodes = useCallback((query: string): ICD10Option[] => {
    if (!query || query.length < 2) return [];

    const upperQuery = query.toUpperCase();
    const lowerQuery = query.toLowerCase();

    return ICD10_CODES.filter(
      (item) =>
        item.code.toUpperCase().includes(upperQuery) ||
        item.description.toLowerCase().includes(lowerQuery)
    ).slice(0, 10);
  }, []);

  // Update suggestions when input changes
  useEffect(() => {
    const results = searchCodes(inputValue);
    setSuggestions(results);
    setSelectedIndex(-1);

    // Find description for current value
    const match = ICD10_CODES.find((c) => c.code.toUpperCase() === inputValue.toUpperCase());
    setSelectedDescription(match?.description || null);
  }, [inputValue, searchCodes]);

  // Sync with external value
  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value);
    }
  }, [value]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (newValue: string) => {
    const upperValue = newValue.toUpperCase();
    setInputValue(upperValue);
    setIsOpen(true);
    onChange(upperValue);
  };

  const handleSelect = (option: ICD10Option) => {
    setInputValue(option.code);
    setSelectedDescription(option.description);
    onChange(option.code, option.description);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'ArrowDown' && suggestions.length > 0) {
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSelect(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      selectedElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const inputId = name;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div ref={containerRef} className="form-field relative">
      {label && (
        <label htmlFor={inputId} className="form-label">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            id={inputId}
            name={name}
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => inputValue.length >= 2 && setIsOpen(true)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={placeholder}
            aria-invalid={!!error}
            aria-describedby={errorId}
            aria-autocomplete="list"
            aria-expanded={isOpen}
            aria-controls={isOpen ? `${inputId}-listbox` : undefined}
            autoComplete="off"
            className={`
              form-input font-mono uppercase pr-10
              ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}
            `}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Selected code description */}
        {selectedDescription && !isOpen && (
          <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {selectedDescription}
          </p>
        )}

        {/* Dropdown */}
        {isOpen && suggestions.length > 0 && (
          <ul
            ref={listRef}
            id={`${inputId}-listbox`}
            role="listbox"
            className="
              absolute z-50 mt-1 w-full max-h-60 overflow-auto
              bg-white border border-gray-200 rounded-lg shadow-lg
            "
          >
            {suggestions.map((option, index) => (
              <li
                key={option.code}
                role="option"
                aria-selected={selectedIndex === index}
                onClick={() => handleSelect(option)}
                className={`
                  px-3 py-2 cursor-pointer
                  ${selectedIndex === index ? 'bg-primary-50 text-primary-900' : 'hover:bg-gray-50'}
                `}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium text-primary-600">
                    {option.code}
                  </span>
                  <span className="text-gray-500">-</span>
                  <span className="text-gray-700 text-sm truncate">
                    {option.description}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* No results message */}
        {isOpen && inputValue.length >= 2 && suggestions.length === 0 && (
          <div className="
            absolute z-50 mt-1 w-full px-3 py-4
            bg-white border border-gray-200 rounded-lg shadow-lg
            text-center text-gray-500 text-sm
          ">
            No matching ICD-10 codes found.
            <br />
            <span className="text-xs">Enter the code manually if not in list.</span>
          </div>
        )}
      </div>

      {error && (
        <p id={errorId} className="form-error" role="alert">
          {error}
        </p>
      )}

      {helpText && !error && !selectedDescription && (
        <p className="form-help">
          {helpText}
        </p>
      )}
    </div>
  );
}
