/**
 * Prepare Tab (NestMed Style)
 *
 * Shows referral documents and patient history:
 * - Horizontal scrollable document thumbnails
 * - Orders for Home Care section
 * - Recent Hospitalization card
 * - Past Medical History table
 */

interface PrepareDocument {
  id: string;
  fileId: string;
  filename: string;
  type: 'referral' | 'orders' | 'other';
}

interface PrepareTabProps {
  patientId: string;
}

// Mock data
const MOCK_DOCUMENTS: PrepareDocument[] = [
  { id: '1', fileId: 'REF-2024-001', filename: 'Referral_Form.pdf', type: 'referral' },
  { id: '2', fileId: 'ORD-2024-002', filename: 'Home_Care_Orders.pdf', type: 'orders' },
  { id: '3', fileId: 'LAB-2024-003', filename: 'Lab_Results.pdf', type: 'other' },
  { id: '4', fileId: 'DIS-2024-004', filename: 'Discharge_Summary.pdf', type: 'other' },
];

const MOCK_ORDERS = [
  { therapy: 'Skilled Nursing (SN)', description: 'Assessment and medication management, 1x weekly x 60 days' },
  { therapy: 'Physical Therapy (PT)', description: 'Gait training and strength exercises, 2x weekly x 30 days' },
  { therapy: 'Occupational Therapy (OT)', description: 'ADL training and home safety, 1x weekly x 30 days' },
];

const MOCK_PMH = [
  { condition: 'Congestive Heart Failure', notes: 'EF 35%, on diuretics', icd10: 'I50.9' },
  { condition: 'Type 2 Diabetes Mellitus', notes: 'A1C 7.2%, insulin dependent', icd10: 'E11.9' },
  { condition: 'Essential Hypertension', notes: 'Well controlled on medication', icd10: 'I10' },
  { condition: 'Chronic Kidney Disease, Stage 3', notes: 'GFR 42', icd10: 'N18.3' },
  { condition: 'Atrial Fibrillation', notes: 'On anticoagulation', icd10: 'I48.91' },
];

export default function PrepareTab({ patientId: _patientId }: PrepareTabProps) {
  return (
    <div className="space-y-6 pb-8">
      {/* Referral Documents */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Referral Documents</h2>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {MOCK_DOCUMENTS.map((doc) => (
            <button
              key={doc.id}
              className="flex-shrink-0 w-28 bg-white rounded-xl border border-gray-200 p-3 hover:border-green-300 hover:shadow-sm transition-all"
            >
              {/* Document Icon */}
              <div className="w-full aspect-[3/4] bg-gray-100 rounded-lg flex items-center justify-center mb-2">
                <svg
                  className="w-10 h-10 text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              {/* File ID */}
              <p className="text-xs font-mono text-gray-500 text-center truncate">
                {doc.fileId}
              </p>
            </button>
          ))}

          {/* Add Document */}
          <button className="flex-shrink-0 w-28 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 p-3 hover:border-green-400 hover:bg-green-50 transition-all">
            <div className="w-full aspect-[3/4] flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <p className="text-xs text-gray-500 text-center mt-2">Add</p>
          </button>
        </div>
      </section>

      {/* Orders for Home Care */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Orders for Home Care</h2>
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {MOCK_ORDERS.map((order, index) => (
            <div key={index} className="p-4">
              <h3 className="font-medium text-gray-900">{order.therapy}</h3>
              <p className="text-sm text-gray-500 mt-1">{order.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Recent Hospitalization */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Recent Hospitalization</h2>
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          {/* Hospital Info */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-medium text-gray-900">General Hospital</h3>
              <p className="text-sm text-gray-500">Jan 10-14, 2025 (4 days)</p>
            </div>
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
              Inpatient
            </span>
          </div>

          {/* Admission Narrative */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
              Admission Narrative
            </h4>
            <p className="text-sm text-gray-700">
              Patient admitted with acute exacerbation of CHF. Presented with SOB, lower extremity edema,
              and 10 lb weight gain over 2 weeks. BNP elevated at 850.
            </p>
          </div>

          {/* Primary DX */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
              Primary DX for Admission
            </h4>
            <p className="text-sm text-gray-700">
              <span className="font-mono text-gray-500">I50.9</span> - Acute on chronic systolic heart failure exacerbation
            </p>
          </div>

          {/* Interventions */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
              Interventions
            </h4>
            <p className="text-sm text-gray-700">
              IV Lasix 80mg BID, strict I&O, telemetry monitoring, Echo performed showing EF 35%,
              cardiology consult obtained
            </p>
          </div>

          {/* Discharge Plan */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
              Discharge Plan
            </h4>
            <p className="text-sm text-gray-700">
              Home with home health services for SN visits, PT for reconditioning, medication teaching
            </p>
          </div>

          {/* Discharge Condition */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
              Discharge Condition
            </h4>
            <p className="text-sm text-gray-700">
              Stable, ambulating with standby assist, O2 sats 94% on RA, edema reduced to 1+ bilateral
            </p>
          </div>
        </div>
      </section>

      {/* Past Medical History */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Past Medical History</h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Condition
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {MOCK_PMH.map((item, index) => (
                <tr key={index}>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">{item.condition}</p>
                    <p className="text-xs text-gray-500 font-mono">{item.icd10}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {item.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
