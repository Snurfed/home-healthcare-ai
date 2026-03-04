/**
 * Quick Inputs
 *
 * Minimal manual inputs: time in/out, location.
 * These are the only fields that can't be extracted from audio.
 */

interface QuickInputsProps {
  timeIn?: string;
  timeOut?: string;
  location?: string;
  onChange: (info: { timeIn?: string; timeOut?: string; location?: string }) => void;
  disabled?: boolean;
}

export function QuickInputs({
  timeIn,
  timeOut,
  location,
  onChange,
  disabled,
}: QuickInputsProps) {
  const setNow = (field: 'timeIn' | 'timeOut') => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    onChange({ [field]: now });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <span>⏱️</span>
        Visit Info
      </h3>

      <div className="space-y-3">
        {/* Time In */}
        <div>
          <label className="block text-xs text-gray-600 mb-1">Time In</label>
          <div className="flex gap-2">
            <input
              type="time"
              value={timeIn || ''}
              onChange={(e) => onChange({ timeIn: e.target.value })}
              disabled={disabled}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
            />
            <button
              onClick={() => setNow('timeIn')}
              disabled={disabled}
              className="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 disabled:opacity-50"
            >
              Now
            </button>
          </div>
        </div>

        {/* Time Out */}
        <div>
          <label className="block text-xs text-gray-600 mb-1">Time Out</label>
          <div className="flex gap-2">
            <input
              type="time"
              value={timeOut || ''}
              onChange={(e) => onChange({ timeOut: e.target.value })}
              disabled={disabled}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
            />
            <button
              onClick={() => setNow('timeOut')}
              disabled={disabled}
              className="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 disabled:opacity-50"
            >
              Now
            </button>
          </div>
        </div>

        {/* Location */}
        <div>
          <label className="block text-xs text-gray-600 mb-1">Location</label>
          <select
            value={location || 'home'}
            onChange={(e) => onChange({ location: e.target.value })}
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
          >
            <option value="home">Patient Home</option>
            <option value="facility">Facility</option>
            <option value="telehealth">Telehealth</option>
          </select>
        </div>
      </div>
    </div>
  );
}

export default QuickInputs;
