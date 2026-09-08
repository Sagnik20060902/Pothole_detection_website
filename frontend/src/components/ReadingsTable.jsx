import React from 'react';
import { formatDate, formatCoordinates, getDepthSeverity } from '../utils/format';
import { Database, AlertTriangle } from 'lucide-react';

export default function ReadingsTable({ readings = [], loading }) {
  if (loading) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <Database className="w-8 h-8 text-slate-600 animate-spin" />
          <span>Loading readings log...</span>
        </div>
      </div>
    );
  }

  if (readings.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <AlertTriangle className="w-8 h-8 text-amber-500/70" />
          <span className="text-sm font-medium text-slate-300">No pothole readings stored yet</span>
          <p className="text-xs text-slate-500 max-w-sm">
            Use the bulk upload API or click &quot;Upload Batch Dump&quot; above to sync ESP32 sensor logs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
            Raw Data Log
          </h2>
        </div>
        <span className="text-xs text-slate-400 font-mono">
          Showing {readings.length} records
        </span>
      </div>

      <div className="max-h-[420px] overflow-y-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 bg-slate-950/90 backdrop-blur-md text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
            <tr>
              <th className="py-3 px-6">ID</th>
              <th className="py-3 px-6">Sensor Timestamp</th>
              <th className="py-3 px-6">Coordinates (Lat, Lng)</th>
              <th className="py-3 px-6 text-right">Pothole Depth</th>
              <th className="py-3 px-6">Severity Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
            {readings.map((reading) => {
              const depth = reading.pothole_depth ?? reading.particle_depth ?? 0;
              const severity = getDepthSeverity(depth);

              return (
                <tr
                  key={reading.id || `${reading.sensor_timestamp}-${reading.latitude}`}
                  className="hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-3 px-6 font-semibold text-slate-500">
                    #{reading.id}
                  </td>
                  <td className="py-3 px-6 text-slate-200 font-sans">
                    {formatDate(reading.sensor_timestamp)}
                  </td>
                  <td className="py-3 px-6 text-slate-300">
                    {formatCoordinates(reading.latitude, reading.longitude)}
                  </td>
                  <td className="py-3 px-6 text-right font-bold text-slate-100">
                    {depth.toFixed(1)} <span className="text-xs text-slate-400 font-sans font-normal">cm</span>
                  </td>
                  <td className="py-3 px-6 font-sans">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${severity.colorClass}`}>
                      {severity.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
