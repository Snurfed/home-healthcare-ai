/**
 * Create Assessment Page
 *
 * Placeholder - would need patient selection and episode creation
 */

import { Link } from 'react-router-dom';
import { Button, Alert } from '@components/common';

export default function CreateAssessmentPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New OASIS Assessment</h1>
        <p className="text-gray-500">Create a new patient assessment</p>
      </div>

      <div className="bg-white rounded-lg shadow-card p-6">
        <Alert variant="info">
          Patient selection and episode creation functionality will be implemented.
          This requires the patient API integration.
        </Alert>

        <div className="mt-6 space-y-4">
          <p className="text-gray-600">
            To create an assessment, you would:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-gray-600">
            <li>Search for or select an existing patient</li>
            <li>Select or create a care episode</li>
            <li>Choose the assessment type (SOC, ROC, Recert, etc.)</li>
            <li>Optionally copy from a previous assessment</li>
          </ol>
        </div>

        <div className="mt-6 flex gap-4">
          <Link to="/assessments">
            <Button variant="secondary">Back to List</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
