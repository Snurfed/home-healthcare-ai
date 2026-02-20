/**
 * VitalSignsEntry Component
 *
 * Comprehensive vital signs input with:
 * - Blood pressure (systolic/diastolic)
 * - Heart rate
 * - Respiratory rate
 * - Temperature
 * - Oxygen saturation
 * - Weight
 * - Blood glucose (optional)
 * - Pain scale
 */

import { useState, useCallback, useEffect } from 'react';
import { NumericInput, Badge } from '@components/common';
import type { VitalSigns } from '@typedefs/index';

interface VitalSignsEntryProps {
  value: VitalSigns;
  onChange: (vitals: VitalSigns) => void;
  disabled?: boolean;
  showGlucose?: boolean;
  showPain?: boolean;
  compact?: boolean;
}

// Validation ranges for vital signs
const VITAL_RANGES = {
  bloodPressureSystolic: { min: 50, max: 300, unit: 'mmHg' },
  bloodPressureDiastolic: { min: 30, max: 200, unit: 'mmHg' },
  heartRate: { min: 30, max: 250, unit: 'bpm' },
  respiratoryRate: { min: 4, max: 60, unit: '/min' },
  temperatureF: { min: 90, max: 110, unit: 'F' },
  temperatureC: { min: 32, max: 43, unit: 'C' },
  oxygenSaturation: { min: 50, max: 100, unit: '%' },
  weightLbs: { min: 20, max: 700, unit: 'lbs' },
  weightKg: { min: 10, max: 320, unit: 'kg' },
  bloodGlucose: { min: 20, max: 600, unit: 'mg/dL' },
  pain: { min: 0, max: 10, unit: '' },
};

// Helper to check if value is abnormal
function isAbnormal(field: keyof VitalSigns, value: number | undefined, vitals: VitalSigns): boolean {
  if (value === undefined) return false;

  switch (field) {
    case 'bloodPressureSystolic':
      return value < 90 || value > 180;
    case 'bloodPressureDiastolic':
      return value < 60 || value > 120;
    case 'heartRate':
      return value < 60 || value > 100;
    case 'respiratoryRate':
      return value < 12 || value > 20;
    case 'temperature':
      if (vitals.temperatureUnit === 'C') {
        return value < 36.1 || value > 38.3;
      }
      return value < 97 || value > 101;
    case 'oxygenSaturation':
      return value < 95;
    case 'pain':
      return value >= 7;
    default:
      return false;
  }
}

export default function VitalSignsEntry({
  value,
  onChange,
  disabled = false,
  showGlucose = false,
  showPain = true,
  compact = false,
}: VitalSignsEntryProps) {
  const [tempUnit, setTempUnit] = useState<'F' | 'C'>(value.temperatureUnit || 'F');
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'kg'>(value.weightUnit || 'lbs');

  // Update parent when local state changes
  useEffect(() => {
    if (value.temperatureUnit !== tempUnit || value.weightUnit !== weightUnit) {
      onChange({
        ...value,
        temperatureUnit: tempUnit,
        weightUnit: weightUnit,
      });
    }
  }, [tempUnit, weightUnit]);

  const handleChange = useCallback(
    (field: keyof VitalSigns, fieldValue: number | null) => {
      onChange({
        ...value,
        [field]: fieldValue ?? undefined,
      });
    },
    [value, onChange]
  );

  const handleOxygenOnRoomChange = useCallback(
    (checked: boolean) => {
      onChange({
        ...value,
        oxygenSaturationOnRoom: checked,
        oxygenLitersPerMin: checked ? undefined : value.oxygenLitersPerMin,
      });
    },
    [value, onChange]
  );

  const gridClass = compact
    ? 'grid grid-cols-2 sm:grid-cols-3 gap-3'
    : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4';

  return (
    <div className="space-y-6">
      {/* Blood Pressure */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
          Blood Pressure
          {isAbnormal('bloodPressureSystolic', value.bloodPressureSystolic, value) ||
          isAbnormal('bloodPressureDiastolic', value.bloodPressureDiastolic, value) ? (
            <Badge variant="warning" size="sm">
              Abnormal
            </Badge>
          ) : null}
        </h4>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <NumericInput
              value={value.bloodPressureSystolic ?? null}
              onChange={(v) => handleChange('bloodPressureSystolic', v)}
              min={VITAL_RANGES.bloodPressureSystolic.min}
              max={VITAL_RANGES.bloodPressureSystolic.max}
              placeholder="Systolic"
              disabled={disabled}
              showButtons={false}
              className={
                isAbnormal('bloodPressureSystolic', value.bloodPressureSystolic, value)
                  ? 'border-orange-400 bg-orange-50'
                  : ''
              }
            />
          </div>
          <span className="text-gray-500 text-xl font-light">/</span>
          <div className="flex-1">
            <NumericInput
              value={value.bloodPressureDiastolic ?? null}
              onChange={(v) => handleChange('bloodPressureDiastolic', v)}
              min={VITAL_RANGES.bloodPressureDiastolic.min}
              max={VITAL_RANGES.bloodPressureDiastolic.max}
              placeholder="Diastolic"
              disabled={disabled}
              showButtons={false}
              className={
                isAbnormal('bloodPressureDiastolic', value.bloodPressureDiastolic, value)
                  ? 'border-orange-400 bg-orange-50'
                  : ''
              }
            />
          </div>
          <span className="text-gray-500 text-sm">mmHg</span>
        </div>
      </div>

      {/* Other Vitals Grid */}
      <div className={gridClass}>
        {/* Heart Rate */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            Heart Rate
            {isAbnormal('heartRate', value.heartRate, value) && (
              <Badge variant="warning" size="sm">
                Abnormal
              </Badge>
            )}
          </h4>
          <NumericInput
            value={value.heartRate ?? null}
            onChange={(v) => handleChange('heartRate', v)}
            min={VITAL_RANGES.heartRate.min}
            max={VITAL_RANGES.heartRate.max}
            unit="bpm"
            disabled={disabled}
            showButtons={!compact}
            className={
              isAbnormal('heartRate', value.heartRate, value) ? 'border-orange-400 bg-orange-50' : ''
            }
          />
        </div>

        {/* Respiratory Rate */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            Respiratory Rate
            {isAbnormal('respiratoryRate', value.respiratoryRate, value) && (
              <Badge variant="warning" size="sm">
                Abnormal
              </Badge>
            )}
          </h4>
          <NumericInput
            value={value.respiratoryRate ?? null}
            onChange={(v) => handleChange('respiratoryRate', v)}
            min={VITAL_RANGES.respiratoryRate.min}
            max={VITAL_RANGES.respiratoryRate.max}
            unit="/min"
            disabled={disabled}
            showButtons={!compact}
            className={
              isAbnormal('respiratoryRate', value.respiratoryRate, value)
                ? 'border-orange-400 bg-orange-50'
                : ''
            }
          />
        </div>

        {/* Temperature */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
              Temperature
              {isAbnormal('temperature', value.temperature, value) && (
                <Badge variant="warning" size="sm">
                  Abnormal
                </Badge>
              )}
            </h4>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setTempUnit('F')}
                disabled={disabled}
                className={`px-2 py-0.5 text-xs rounded ${
                  tempUnit === 'F'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                } disabled:opacity-50`}
              >
                F
              </button>
              <button
                type="button"
                onClick={() => setTempUnit('C')}
                disabled={disabled}
                className={`px-2 py-0.5 text-xs rounded ${
                  tempUnit === 'C'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                } disabled:opacity-50`}
              >
                C
              </button>
            </div>
          </div>
          <NumericInput
            value={value.temperature ?? null}
            onChange={(v) => handleChange('temperature', v)}
            min={tempUnit === 'F' ? VITAL_RANGES.temperatureF.min : VITAL_RANGES.temperatureC.min}
            max={tempUnit === 'F' ? VITAL_RANGES.temperatureF.max : VITAL_RANGES.temperatureC.max}
            step={0.1}
            unit={`°${tempUnit}`}
            disabled={disabled}
            showButtons={!compact}
            className={
              isAbnormal('temperature', value.temperature, value)
                ? 'border-orange-400 bg-orange-50'
                : ''
            }
          />
        </div>

        {/* Oxygen Saturation */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            SpO2
            {isAbnormal('oxygenSaturation', value.oxygenSaturation, value) && (
              <Badge variant="error" size="sm">
                Low
              </Badge>
            )}
          </h4>
          <NumericInput
            value={value.oxygenSaturation ?? null}
            onChange={(v) => handleChange('oxygenSaturation', v)}
            min={VITAL_RANGES.oxygenSaturation.min}
            max={VITAL_RANGES.oxygenSaturation.max}
            unit="%"
            disabled={disabled}
            showButtons={!compact}
            className={
              isAbnormal('oxygenSaturation', value.oxygenSaturation, value)
                ? 'border-red-400 bg-red-50'
                : ''
            }
          />
          <div className="mt-2 flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={value.oxygenSaturationOnRoom ?? true}
                onChange={(e) => handleOxygenOnRoomChange(e.target.checked)}
                disabled={disabled}
                className="w-3.5 h-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              On room air
            </label>
            {!value.oxygenSaturationOnRoom && (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={value.oxygenLitersPerMin ?? ''}
                  onChange={(e) =>
                    handleChange(
                      'oxygenLitersPerMin',
                      e.target.value ? parseFloat(e.target.value) : null
                    )
                  }
                  disabled={disabled}
                  className="w-12 px-1 py-0.5 text-xs border border-gray-300 rounded text-center"
                  placeholder="L"
                  min="0.5"
                  max="15"
                  step="0.5"
                />
                <span className="text-xs text-gray-500">L/min</span>
              </div>
            )}
          </div>
        </div>

        {/* Weight */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-700">Weight</h4>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setWeightUnit('lbs')}
                disabled={disabled}
                className={`px-2 py-0.5 text-xs rounded ${
                  weightUnit === 'lbs'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                } disabled:opacity-50`}
              >
                lbs
              </button>
              <button
                type="button"
                onClick={() => setWeightUnit('kg')}
                disabled={disabled}
                className={`px-2 py-0.5 text-xs rounded ${
                  weightUnit === 'kg'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                } disabled:opacity-50`}
              >
                kg
              </button>
            </div>
          </div>
          <NumericInput
            value={value.weight ?? null}
            onChange={(v) => handleChange('weight', v)}
            min={weightUnit === 'lbs' ? VITAL_RANGES.weightLbs.min : VITAL_RANGES.weightKg.min}
            max={weightUnit === 'lbs' ? VITAL_RANGES.weightLbs.max : VITAL_RANGES.weightKg.max}
            step={0.1}
            unit={weightUnit}
            disabled={disabled}
            showButtons={!compact}
          />
        </div>

        {/* Blood Glucose (optional) */}
        {showGlucose && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Blood Glucose</h4>
            <NumericInput
              value={value.bloodGlucose ?? null}
              onChange={(v) => handleChange('bloodGlucose', v)}
              min={VITAL_RANGES.bloodGlucose.min}
              max={VITAL_RANGES.bloodGlucose.max}
              unit="mg/dL"
              disabled={disabled}
              showButtons={!compact}
            />
            <select
              value={value.bloodGlucoseTiming ?? ''}
              onChange={(e) =>
                onChange({
                  ...value,
                  bloodGlucoseTiming: e.target.value as VitalSigns['bloodGlucoseTiming'],
                })
              }
              disabled={disabled}
              className="mt-2 w-full text-xs border border-gray-300 rounded px-2 py-1"
            >
              <option value="">Timing...</option>
              <option value="fasting">Fasting</option>
              <option value="random">Random</option>
              <option value="pre_meal">Pre-meal</option>
              <option value="post_meal">Post-meal</option>
            </select>
          </div>
        )}
      </div>

      {/* Pain Scale */}
      {showPain && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            Pain Assessment (0-10 Scale)
            {isAbnormal('pain', value.pain, value) && (
              <Badge variant="error" size="sm">
                Severe
              </Badge>
            )}
          </h4>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => handleChange('pain', level)}
                  disabled={disabled}
                  className={`
                    w-8 h-8 rounded-md text-sm font-medium transition-all
                    ${
                      value.pain === level
                        ? level <= 3
                          ? 'bg-green-500 text-white ring-2 ring-green-600'
                          : level <= 6
                            ? 'bg-yellow-500 text-white ring-2 ring-yellow-600'
                            : 'bg-red-500 text-white ring-2 ring-red-600'
                        : level <= 3
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : level <= 6
                            ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  {level}
                </button>
              ))}
            </div>
            {value.pain !== undefined && (
              <span className="text-sm text-gray-600 ml-2">
                {value.pain === 0
                  ? 'No pain'
                  : value.pain <= 3
                    ? 'Mild'
                    : value.pain <= 6
                      ? 'Moderate'
                      : 'Severe'}
              </span>
            )}
          </div>
          {value.pain !== undefined && value.pain > 0 && (
            <div className="mt-3">
              <label className="block text-xs text-gray-600 mb-1">Pain Location</label>
              <input
                type="text"
                value={value.painLocation ?? ''}
                onChange={(e) => onChange({ ...value, painLocation: e.target.value })}
                disabled={disabled}
                placeholder="e.g., Lower back, right knee..."
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
