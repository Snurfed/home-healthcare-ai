/**
 * PlanOfCareForm Component
 *
 * CMS-485 Home Health Certification and Plan of Care form.
 * Includes auto-population from OASIS assessment data.
 */

import { useState, useCallback, useEffect } from 'react';
import { Alert, Badge, Button, Spinner, Input, Select } from '@components/common';
import type {
  PlanOfCare,
  Diagnosis,
  ServiceFrequency,
  CareGoal,
  Discipline,
  AutoPopulateFromOasisResponse,
} from '@typedefs/index';
import { DISCIPLINE_LABELS } from '@constants/visitFormConfig';

interface PlanOfCareFormProps {
  planOfCare: PlanOfCare | null;
  episodeId: string;
  patientId: string;
  oasisAssessmentId?: string;
  onSave?: (data: Partial<PlanOfCare>) => Promise<void>;
  onAutoPopulate?: () => Promise<AutoPopulateFromOasisResponse>;
  onSign?: (signatureType: 'physician' | 'nurse') => Promise<void>;
  isLoading?: boolean;
  isSaving?: boolean;
}

// Section icons
const DocumentIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
);

const SparklesIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
    />
  </svg>
);

const PlusIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const TrashIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);

const DISCIPLINES: Discipline[] = ['RN', 'PT', 'OT', 'SLP', 'MSW', 'HHA'];

const PROGNOSIS_OPTIONS = [
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'guarded', label: 'Guarded' },
  { value: 'poor', label: 'Poor' },
];

export default function PlanOfCareForm({
  planOfCare,
  episodeId: _episodeId,
  patientId: _patientId,
  oasisAssessmentId,
  onSave,
  onAutoPopulate,
  onSign,
  isLoading = false,
  isSaving = false,
}: PlanOfCareFormProps) {
  // Note: episodeId and patientId are reserved for future API calls
  void _episodeId;
  void _patientId;
  // Form state
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>(planOfCare?.diagnoses || []);
  const [serviceFrequencies, setServiceFrequencies] = useState<ServiceFrequency[]>(
    planOfCare?.serviceFrequencies || []
  );
  const [goals, setGoals] = useState<CareGoal[]>(planOfCare?.goals || []);
  const [functionalLimitations, setFunctionalLimitations] = useState<string[]>(
    planOfCare?.functionalLimitations || []
  );
  const [safetyMeasures, setSafetyMeasures] = useState<string[]>(
    planOfCare?.safetyMeasures || []
  );
  const [dmeNeeds, setDmeNeeds] = useState<string[]>(planOfCare?.dmeNeeds || []);
  const [prognosis, setPrognosis] = useState<PlanOfCare['prognosis']>(planOfCare?.prognosis || 'good');
  const [mentalStatus, setMentalStatus] = useState(planOfCare?.mentalStatus || '');
  const [nutritionalReqs, setNutritionalReqs] = useState(
    planOfCare?.nutritionalRequirements || ''
  );
  const [allowedActivities, setAllowedActivities] = useState(
    planOfCare?.allowedActivities || ''
  );
  const [dischargeGoals, setDischargeGoals] = useState(planOfCare?.dischargeGoals || '');

  // UI state
  const [isAutoPopulating, setIsAutoPopulating] = useState(false);
  const [autoPopulateResult, setAutoPopulateResult] = useState<AutoPopulateFromOasisResponse | null>(null);
  const [newLimitation, setNewLimitation] = useState('');
  const [newSafetyMeasure, setNewSafetyMeasure] = useState('');
  const [newDme, setNewDme] = useState('');

  // Sync state when planOfCare prop changes
  useEffect(() => {
    if (planOfCare) {
      setDiagnoses(planOfCare.diagnoses || []);
      setServiceFrequencies(planOfCare.serviceFrequencies || []);
      setGoals(planOfCare.goals || []);
      setFunctionalLimitations(planOfCare.functionalLimitations || []);
      setSafetyMeasures(planOfCare.safetyMeasures || []);
      setDmeNeeds(planOfCare.dmeNeeds || []);
      setPrognosis(planOfCare.prognosis || 'good');
      setMentalStatus(planOfCare.mentalStatus || '');
      setNutritionalReqs(planOfCare.nutritionalRequirements || '');
      setAllowedActivities(planOfCare.allowedActivities || '');
      setDischargeGoals(planOfCare.dischargeGoals || '');
    }
  }, [planOfCare]);

  // Handle auto-populate from OASIS
  const handleAutoPopulate = useCallback(async () => {
    if (!onAutoPopulate) return;

    setIsAutoPopulating(true);
    setAutoPopulateResult(null);

    try {
      const result = await onAutoPopulate();
      setAutoPopulateResult(result);

      // Apply populated values
      if (result.success) {
        for (const item of result.populated) {
          switch (item.field) {
            case 'diagnoses':
              setDiagnoses(item.value as Diagnosis[]);
              break;
            case 'functionalLimitations':
              setFunctionalLimitations(item.value as string[]);
              break;
            case 'mentalStatus':
              setMentalStatus(item.value as string);
              break;
            case 'safetyMeasures':
              setSafetyMeasures(item.value as string[]);
              break;
          }
        }
      }
    } finally {
      setIsAutoPopulating(false);
    }
  }, [onAutoPopulate]);

  // Diagnosis management
  const addDiagnosis = useCallback(() => {
    const newDx: Diagnosis = {
      code: '',
      description: '',
      isPrimary: diagnoses.length === 0,
      sequence: diagnoses.length + 1,
    };
    setDiagnoses([...diagnoses, newDx]);
  }, [diagnoses]);

  const updateDiagnosis = useCallback((index: number, updates: Partial<Diagnosis>) => {
    setDiagnoses((prev) =>
      prev.map((dx, i) => (i === index ? { ...dx, ...updates } : dx))
    );
  }, []);

  const removeDiagnosis = useCallback((index: number) => {
    setDiagnoses((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Service frequency management
  const addServiceFrequency = useCallback((discipline: Discipline) => {
    const existing = serviceFrequencies.find((sf) => sf.discipline === discipline);
    if (existing) return;

    const newSf: ServiceFrequency = {
      discipline,
      frequency: '',
    };
    setServiceFrequencies([...serviceFrequencies, newSf]);
  }, [serviceFrequencies]);

  const updateServiceFrequency = useCallback(
    (discipline: Discipline, frequency: string) => {
      setServiceFrequencies((prev) =>
        prev.map((sf) => (sf.discipline === discipline ? { ...sf, frequency } : sf))
      );
    },
    []
  );

  const removeServiceFrequency = useCallback((discipline: Discipline) => {
    setServiceFrequencies((prev) => prev.filter((sf) => sf.discipline !== discipline));
  }, []);

  // Goal management
  const addGoal = useCallback((discipline: Discipline, goalType: 'short_term' | 'long_term') => {
    const newGoal: CareGoal = {
      id: `goal_${Date.now()}`,
      discipline,
      goalType,
      description: '',
      targetDate: '',
      status: 'active',
    };
    setGoals([...goals, newGoal]);
  }, [goals]);

  const updateGoal = useCallback((goalId: string, updates: Partial<CareGoal>) => {
    setGoals((prev) =>
      prev.map((g) => (g.id === goalId ? { ...g, ...updates } : g))
    );
  }, []);

  const removeGoal = useCallback((goalId: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== goalId));
  }, []);

  // List management helpers
  const addToList = useCallback(
    (
      value: string,
      setter: React.Dispatch<React.SetStateAction<string[]>>,
      inputSetter: React.Dispatch<React.SetStateAction<string>>
    ) => {
      if (value.trim()) {
        setter((prev) => [...prev, value.trim()]);
        inputSetter('');
      }
    },
    []
  );

  const removeFromList = useCallback(
    (index: number, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
      setter((prev) => prev.filter((_, i) => i !== index));
    },
    []
  );

  // Save handler
  const handleSave = useCallback(async () => {
    if (!onSave) return;

    await onSave({
      diagnoses,
      serviceFrequencies,
      goals,
      functionalLimitations,
      safetyMeasures,
      dmeNeeds,
      prognosis: prognosis as PlanOfCare['prognosis'],
      mentalStatus,
      nutritionalRequirements: nutritionalReqs,
      allowedActivities,
      dischargeGoals,
    });
  }, [
    onSave,
    diagnoses,
    serviceFrequencies,
    goals,
    functionalLimitations,
    safetyMeasures,
    dmeNeeds,
    prognosis,
    mentalStatus,
    nutritionalReqs,
    allowedActivities,
    dischargeGoals,
  ]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DocumentIcon className="w-6 h-6 text-primary-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                CMS-485 Plan of Care
              </h2>
              <p className="text-sm text-gray-500">
                Home Health Certification and Plan of Care
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {planOfCare?.status && (
              <Badge
                variant={
                  planOfCare.status === 'active'
                    ? 'success'
                    : planOfCare.status === 'pending_signature'
                      ? 'warning'
                      : 'default'
                }
              >
                {planOfCare.status.replace('_', ' ')}
              </Badge>
            )}

            {oasisAssessmentId && onAutoPopulate && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleAutoPopulate}
                disabled={isAutoPopulating}
              >
                {isAutoPopulating ? (
                  <>
                    <Spinner size="sm" />
                    <span className="ml-1">Populating...</span>
                  </>
                ) : (
                  <>
                    <SparklesIcon className="w-4 h-4 mr-1" />
                    Auto-Populate from OASIS
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {autoPopulateResult && (
          <Alert
            variant={autoPopulateResult.success ? 'success' : 'warning'}
            className="mt-4"
          >
            {autoPopulateResult.success
              ? `Successfully populated ${autoPopulateResult.populated.length} fields from OASIS`
              : 'Some fields could not be populated'}
            {autoPopulateResult.warnings?.map((w, i) => (
              <span key={i} className="block text-sm">
                {w}
              </span>
            ))}
          </Alert>
        )}
      </div>

      {/* Diagnoses Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Diagnoses (ICD-10)</h3>
          <Button variant="secondary" size="sm" onClick={addDiagnosis}>
            <PlusIcon className="w-4 h-4 mr-1" />
            Add Diagnosis
          </Button>
        </div>

        <div className="space-y-3">
          {diagnoses.map((dx, index) => (
            <div
              key={index}
              className={`flex items-start gap-3 p-3 rounded-lg ${
                dx.isPrimary ? 'bg-primary-50 border border-primary-200' : 'bg-gray-50'
              }`}
            >
              <div className="flex-shrink-0 pt-2">
                <Badge variant={dx.isPrimary ? 'info' : 'default'} size="sm">
                  {dx.isPrimary ? 'Primary' : `#${index + 1}`}
                </Badge>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-3">
                <Input
                  placeholder="ICD-10 Code"
                  value={dx.code}
                  onChange={(e) => updateDiagnosis(index, { code: e.target.value })}
                />
                <Input
                  placeholder="Description"
                  value={dx.description}
                  onChange={(e) => updateDiagnosis(index, { description: e.target.value })}
                />
              </div>
              <button
                onClick={() => removeDiagnosis(index)}
                className="text-gray-400 hover:text-red-500 p-1"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          ))}

          {diagnoses.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              No diagnoses added. Click "Add Diagnosis" to begin.
            </p>
          )}
        </div>
      </div>

      {/* Service Frequencies Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-4">Service Frequencies</h3>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {DISCIPLINES.map((discipline) => {
            const sf = serviceFrequencies.find((s) => s.discipline === discipline);
            return (
              <div key={discipline} className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!sf}
                    onChange={(e) => {
                      if (e.target.checked) {
                        addServiceFrequency(discipline);
                      } else {
                        removeServiceFrequency(discipline);
                      }
                    }}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    {DISCIPLINE_LABELS[discipline]}
                  </span>
                </label>
                {sf && (
                  <Input
                    placeholder="e.g., 2W2, 1W4"
                    value={sf.frequency}
                    onChange={(e) => updateServiceFrequency(discipline, e.target.value)}
                    className="text-sm"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Goals Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Goals</h3>
          <div className="flex gap-2">
            <select
              className="text-sm border border-gray-300 rounded px-2 py-1"
              onChange={(e) => {
                const [discipline, type] = e.target.value.split('_') as [Discipline, 'short_term' | 'long_term'];
                if (discipline && type) {
                  addGoal(discipline, type);
                  e.target.value = '';
                }
              }}
              defaultValue=""
            >
              <option value="" disabled>
                + Add Goal...
              </option>
              {DISCIPLINES.map((d) => (
                <optgroup key={d} label={DISCIPLINE_LABELS[d]}>
                  <option value={`${d}_short_term`}>Short-Term Goal</option>
                  <option value={`${d}_long_term`}>Long-Term Goal</option>
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-3">
          {goals.map((goal) => (
            <div
              key={goal.id}
              className="p-3 bg-gray-50 rounded-lg space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="default" size="sm">
                    {DISCIPLINE_LABELS[goal.discipline]}
                  </Badge>
                  <Badge variant={goal.goalType === 'short_term' ? 'info' : 'warning'} size="sm">
                    {goal.goalType === 'short_term' ? 'Short-Term' : 'Long-Term'}
                  </Badge>
                </div>
                <button
                  onClick={() => removeGoal(goal.id)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
              <textarea
                placeholder="Goal description..."
                value={goal.description}
                onChange={(e) => updateGoal(goal.id, { description: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              />
              <div className="flex gap-3">
                <Input
                  type="date"
                  label="Target Date"
                  value={goal.targetDate}
                  onChange={(e) => updateGoal(goal.id, { targetDate: e.target.value })}
                  className="flex-1"
                />
                <Input
                  placeholder="Measurable Outcome"
                  value={goal.measurableOutcome || ''}
                  onChange={(e) => updateGoal(goal.id, { measurableOutcome: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>
          ))}

          {goals.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              No goals added. Use the dropdown above to add goals.
            </p>
          )}
        </div>
      </div>

      {/* Additional Information Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Functional Limitations */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Functional Limitations</h3>
          <div className="space-y-2">
            {functionalLimitations.map((item, index) => (
              <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                <span className="flex-1 text-sm">{item}</span>
                <button
                  onClick={() => removeFromList(index, setFunctionalLimitations)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <TrashIcon className="w-3 h-3" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                placeholder="Add limitation..."
                value={newLimitation}
                onChange={(e) => setNewLimitation(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    addToList(newLimitation, setFunctionalLimitations, setNewLimitation);
                  }
                }}
                className="flex-1"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => addToList(newLimitation, setFunctionalLimitations, setNewLimitation)}
              >
                Add
              </Button>
            </div>
          </div>
        </div>

        {/* Safety Measures */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Safety Measures</h3>
          <div className="space-y-2">
            {safetyMeasures.map((item, index) => (
              <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                <span className="flex-1 text-sm">{item}</span>
                <button
                  onClick={() => removeFromList(index, setSafetyMeasures)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <TrashIcon className="w-3 h-3" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                placeholder="Add safety measure..."
                value={newSafetyMeasure}
                onChange={(e) => setNewSafetyMeasure(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    addToList(newSafetyMeasure, setSafetyMeasures, setNewSafetyMeasure);
                  }
                }}
                className="flex-1"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => addToList(newSafetyMeasure, setSafetyMeasures, setNewSafetyMeasure)}
              >
                Add
              </Button>
            </div>
          </div>
        </div>

        {/* DME Needs */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">DME/Supply Needs</h3>
          <div className="space-y-2">
            {dmeNeeds.map((item, index) => (
              <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                <span className="flex-1 text-sm">{item}</span>
                <button
                  onClick={() => removeFromList(index, setDmeNeeds)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <TrashIcon className="w-3 h-3" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                placeholder="Add DME/supply..."
                value={newDme}
                onChange={(e) => setNewDme(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    addToList(newDme, setDmeNeeds, setNewDme);
                  }
                }}
                className="flex-1"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => addToList(newDme, setDmeNeeds, setNewDme)}
              >
                Add
              </Button>
            </div>
          </div>
        </div>

        {/* Prognosis */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Prognosis</h3>
          <Select
            value={prognosis}
            onChange={(e) => setPrognosis(e.target.value as PlanOfCare['prognosis'])}
            options={PROGNOSIS_OPTIONS}
          />
        </div>
      </div>

      {/* Text Areas */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Mental Status</h3>
          <textarea
            value={mentalStatus}
            onChange={(e) => setMentalStatus(e.target.value)}
            rows={3}
            placeholder="Describe patient's mental status..."
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
          />
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Nutritional Requirements</h3>
          <textarea
            value={nutritionalReqs}
            onChange={(e) => setNutritionalReqs(e.target.value)}
            rows={3}
            placeholder="Describe dietary needs..."
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
          />
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Allowed Activities</h3>
          <textarea
            value={allowedActivities}
            onChange={(e) => setAllowedActivities(e.target.value)}
            rows={3}
            placeholder="Describe activity restrictions and permissions..."
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
          />
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Discharge Goals</h3>
          <textarea
            value={dischargeGoals}
            onChange={(e) => setDischargeGoals(e.target.value)}
            rows={3}
            placeholder="Describe discharge planning goals..."
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {planOfCare?.physicianSignedAt ? (
              <div className="text-sm text-green-600">
                Physician signed: {new Date(planOfCare.physicianSignedAt).toLocaleDateString()}
              </div>
            ) : (
              <Button variant="secondary" onClick={() => onSign?.('physician')}>
                Physician Signature
              </Button>
            )}

            {planOfCare?.nurseSignedAt ? (
              <div className="text-sm text-green-600">
                Nurse signed: {new Date(planOfCare.nurseSignedAt).toLocaleDateString()}
              </div>
            ) : (
              <Button variant="secondary" onClick={() => onSign?.('nurse')}>
                Nurse Signature
              </Button>
            )}
          </div>

          <Button variant="primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Spinner size="sm" />
                <span className="ml-1">Saving...</span>
              </>
            ) : (
              'Save Plan of Care'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
