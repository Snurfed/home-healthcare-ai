/**
 * Patient Info Card
 *
 * Compact patient and episode information display.
 */

interface PatientInfoCardProps {
  patientId: string;
  episodeId: string;
}

export function PatientInfoCard({ patientId: _patientId, episodeId: _episodeId }: PatientInfoCardProps) {
  // TODO: Fetch patient data using patientId and episodeId
  void _patientId;
  void _episodeId;
  // Mock patient data - replace with real API
  const patient = {
    name: 'Doe, John',
    mrn: 'MRN001',
    dob: '03/15/1945',
    age: 79,
    gender: 'Male',
    primaryDx: 'CHF (I50.9)',
    physician: 'Dr. Smith',
    episodeStart: '01/15/2024',
    certPeriod: '01/15 - 03/15/2024',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      {/* Patient Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
          {patient.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{patient.name}</h3>
          <p className="text-xs text-gray-500">
            {patient.mrn} • {patient.age}yo {patient.gender}
          </p>
        </div>
      </div>

      {/* Quick Info */}
      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-500">Primary Dx</span>
          <span className="text-gray-900 font-medium">{patient.primaryDx}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Physician</span>
          <span className="text-gray-900">{patient.physician}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Cert Period</span>
          <span className="text-gray-900">{patient.certPeriod}</span>
        </div>
      </div>

      {/* Episode Badge */}
      <div className="mt-3 p-2 bg-blue-50 rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-blue-600">📋</span>
          <div className="flex-1">
            <p className="text-xs font-medium text-blue-900">Active Episode</p>
            <p className="text-xs text-blue-700">Started {patient.episodeStart}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PatientInfoCard;
