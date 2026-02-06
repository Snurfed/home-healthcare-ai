/**
 * CreatePatientForm Component
 *
 * Form for creating a new patient with standard fields
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreatePatient } from '@hooks/index';
import { Button, Input, Select, Alert } from '@components/common';
import { getErrorMessage } from '@services/index';
import type { PatientListItem } from '@services/patient.service';

// US States for address dropdown
const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
];

const GENDER_OPTIONS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
];

const RELATIONSHIP_OPTIONS = [
  { value: 'SPOUSE', label: 'Spouse' },
  { value: 'PARENT', label: 'Parent' },
  { value: 'CHILD', label: 'Child' },
  { value: 'SIBLING', label: 'Sibling' },
  { value: 'FRIEND', label: 'Friend' },
  { value: 'OTHER', label: 'Other' },
];

// Validation schema
const patientSchema = z.object({
  // Required fields
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'], {
    required_error: 'Gender is required',
  }),
  phoneMobile: z.string().min(10, 'Phone number must be at least 10 digits'),
  addressStreet1: z.string().min(1, 'Street address is required'),
  addressCity: z.string().min(1, 'City is required'),
  addressState: z.string().min(2, 'State is required'),
  addressZipCode: z.string().min(5, 'ZIP code must be at least 5 digits'),
  // Optional fields
  middleName: z.string().optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  primaryPhysicianName: z.string().optional(),
  primaryPhysicianPhone: z.string().optional(),
  // Emergency contact (optional)
  hasEmergencyContact: z.boolean().optional(),
  emergencyFirstName: z.string().optional(),
  emergencyLastName: z.string().optional(),
  emergencyRelationship: z.string().optional(),
  emergencyPhone: z.string().optional(),
});

type PatientFormData = z.infer<typeof patientSchema>;

interface CreatePatientFormProps {
  onSuccess: (patient: PatientListItem) => void;
  onCancel: () => void;
}

export default function CreatePatientForm({ onSuccess, onCancel }: CreatePatientFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [showEmergencyContact, setShowEmergencyContact] = useState(false);
  const createPatient = useCreatePatient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      gender: undefined,
      addressState: '',
    },
  });

  const onSubmit = async (data: PatientFormData) => {
    setServerError(null);

    try {
      // Build emergency contacts array if provided
      const emergencyContacts =
        showEmergencyContact &&
        data.emergencyFirstName &&
        data.emergencyLastName &&
        data.emergencyPhone
          ? [
              {
                firstName: data.emergencyFirstName,
                lastName: data.emergencyLastName,
                relationship: data.emergencyRelationship || 'OTHER',
                phoneMobile: data.emergencyPhone,
              },
            ]
          : undefined;

      const patient = await createPatient.mutateAsync({
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        phoneMobile: data.phoneMobile,
        addressStreet1: data.addressStreet1,
        addressCity: data.addressCity,
        addressState: data.addressState,
        addressZipCode: data.addressZipCode,
        middleName: data.middleName || undefined,
        email: data.email || undefined,
        primaryPhysicianName: data.primaryPhysicianName || undefined,
        primaryPhysicianPhone: data.primaryPhysicianPhone || undefined,
        emergencyContacts,
      });

      onSuccess(patient);
    } catch (error) {
      setServerError(getErrorMessage(error));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {serverError && (
        <Alert variant="error" onClose={() => setServerError(null)}>
          {serverError}
        </Alert>
      )}

      {/* Patient Information */}
      <div>
        <h4 className="text-md font-medium text-gray-900 mb-4">Patient Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            {...register('firstName')}
            label="First Name"
            placeholder="John"
            error={errors.firstName?.message}
            required
          />
          <Input
            {...register('middleName')}
            label="Middle Name"
            placeholder="Michael"
            error={errors.middleName?.message}
          />
          <Input
            {...register('lastName')}
            label="Last Name"
            placeholder="Doe"
            error={errors.lastName?.message}
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Input
            {...register('dateOfBirth')}
            type="date"
            label="Date of Birth"
            error={errors.dateOfBirth?.message}
            required
          />
          <Select
            {...register('gender')}
            label="Gender"
            options={GENDER_OPTIONS}
            placeholder="Select gender"
            error={errors.gender?.message}
            required
          />
        </div>
      </div>

      {/* Contact Information */}
      <div>
        <h4 className="text-md font-medium text-gray-900 mb-4">Contact Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            {...register('phoneMobile')}
            type="tel"
            label="Mobile Phone"
            placeholder="(555) 123-4567"
            error={errors.phoneMobile?.message}
            required
          />
          <Input
            {...register('email')}
            type="email"
            label="Email"
            placeholder="john.doe@email.com"
            error={errors.email?.message}
          />
        </div>
      </div>

      {/* Address */}
      <div>
        <h4 className="text-md font-medium text-gray-900 mb-4">Address</h4>
        <div className="space-y-4">
          <Input
            {...register('addressStreet1')}
            label="Street Address"
            placeholder="123 Main St"
            error={errors.addressStreet1?.message}
            required
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="col-span-2">
              <Input
                {...register('addressCity')}
                label="City"
                placeholder="Springfield"
                error={errors.addressCity?.message}
                required
              />
            </div>
            <Select
              {...register('addressState')}
              label="State"
              options={US_STATES}
              placeholder="Select"
              error={errors.addressState?.message}
              required
            />
            <Input
              {...register('addressZipCode')}
              label="ZIP Code"
              placeholder="12345"
              error={errors.addressZipCode?.message}
              required
            />
          </div>
        </div>
      </div>

      {/* Primary Physician */}
      <div>
        <h4 className="text-md font-medium text-gray-900 mb-4">Primary Physician (Optional)</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            {...register('primaryPhysicianName')}
            label="Physician Name"
            placeholder="Dr. Jane Smith"
            error={errors.primaryPhysicianName?.message}
          />
          <Input
            {...register('primaryPhysicianPhone')}
            type="tel"
            label="Physician Phone"
            placeholder="(555) 987-6543"
            error={errors.primaryPhysicianPhone?.message}
          />
        </div>
      </div>

      {/* Emergency Contact Toggle */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showEmergencyContact}
            onChange={(e) => setShowEmergencyContact(e.target.checked)}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm font-medium text-gray-700">Add Emergency Contact</span>
        </label>
      </div>

      {/* Emergency Contact Fields */}
      {showEmergencyContact && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-md font-medium text-gray-900 mb-4">Emergency Contact</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              {...register('emergencyFirstName')}
              label="First Name"
              placeholder="Jane"
              error={errors.emergencyFirstName?.message}
            />
            <Input
              {...register('emergencyLastName')}
              label="Last Name"
              placeholder="Doe"
              error={errors.emergencyLastName?.message}
            />
            <Select
              {...register('emergencyRelationship')}
              label="Relationship"
              options={RELATIONSHIP_OPTIONS}
              placeholder="Select relationship"
              error={errors.emergencyRelationship?.message}
            />
            <Input
              {...register('emergencyPhone')}
              type="tel"
              label="Phone"
              placeholder="(555) 123-4567"
              error={errors.emergencyPhone?.message}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || createPatient.isLoading}>
          {isSubmitting || createPatient.isLoading ? 'Creating...' : 'Create Patient'}
        </Button>
      </div>
    </form>
  );
}
