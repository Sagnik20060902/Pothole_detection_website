import React, { useState } from 'react';
import { formatDate, formatCoordinates, getDepthSeverity, getSourceInfo, exportReadingsToCSV } from '../utils/format';
import { Database, AlertTriangle, Wifi, Usb, Upload, CheckCircle2, Download, Check } from 'lucide-react';

export default function ReadingsTable({ readings = [], loading, onDeleteReading }) {
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handleDownloadCSV = () => {
    const success = exportReadingsToCSV(readings);
    if (success) {
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2500);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 shadow-sm">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <Database className="w-8 h-8 text-emerald-500 animate-spin" />
          <span className="text-sm font-medium">Loading telemetry readings log...</span>
        </div>
      </div>
    );
  }

  if (readings.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 shadow-sm">
        <div className="flex flex-col items-center gap-3">
          <AlertTriangle className="w-8 h-8 text-amber-500" />
          <span className="text-base font-semibold text-slate-800">No pothole readings stored</span>
          <p className="text-xs text-slate-500 max-w-md">
            All potholes may have been treated! Connect an ESP32 via <strong>WiFi</strong>, plug in via <strong>USB Cable</strong>, or use <strong>Manual Upload</strong> to log new road anomalies.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Road Potholes &amp; Defect Registry
            </h2>
            <span className="text-[11px] text-slate-500">
              Sensors: Ultrasonic (HC-SR04) + Neo-6M GPS &bull; Click "Mark Treated" once repaired
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-3 text-xs">
          <span className="font-mono bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-full font-semibold border border-emerald-200">
            {readings.length} Active Points
          </span>

          <button
            onClick={handleDownloadCSV}
            disabled={readings.length === 0}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-semibold shadow-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 ${
              downloadSuccess
                ? 'bg-emerald-700 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
            title="Download all table readings as a CSV spreadsheet"
          >
            {downloadSuccess ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Downloaded!</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Download CSV</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="max-h-[460px] overflow-y-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-md text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-200 z-10">
            <tr>
              <th className="py-3 px-5">ID</th>
              <th className="py-3 px-5">Source</th>
              <th className="py-3 px-5">Recorded Time</th>
              <th className="py-3 px-5">GPS Coordinates</th>
              <th className="py-3 px-5 text-right">Pothole Depth</th>
              <th className="py-3 px-5">Severity</th>
              <th className="py-3 px-5 text-center">Treatment Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
            {readings.map((reading) => {
              const depth = reading.pothole_depth ?? reading.particle_depth ?? 0;
              const severity = getDepthSeverity(depth);
              const sourceInfo = getSourceInfo(reading.source);

              return (
                <tr
                  key={reading.id || `${reading.sensor_timestamp}-${reading.latitude}`}
                  className="hover:bg-emerald-50/40 transition-colors"
                >
                  <td className="py-3.5 px-5 font-bold text-slate-500">
                    #{reading.id}
                  </td>
                  <td className="py-3.5 px-5 font-sans">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${sourceInfo.badgeClass}`}>
                      {reading.source === 'wifi' ? (
                        <Wifi className="w-3 h-3 text-emerald-600" />
                      ) : reading.source === 'usb_serial' ? (
                        <Usb className="w-3 h-3 text-teal-600" />
                      ) : (
                        <Upload className="w-3 h-3 text-slate-600" />
                      )}
                      <span>{sourceInfo.shortLabel}</span>
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-slate-600 font-sans">
                    {formatDate(reading.sensor_timestamp)}
                  </td>
                  <td className="py-3.5 px-5 text-slate-800 font-semibold">
                    {formatCoordinates(reading.latitude, reading.longitude)}
                  </td>
                  <td className="py-3.5 px-5 text-right font-bold text-slate-900">
                    {depth.toFixed(1)} <span className="text-xs text-slate-400 font-sans font-normal">cm</span>
                  </td>
                  <td className="py-3.5 px-5 font-sans">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${severity.colorClass}`}>
                      {severity.label}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-center font-sans">
                    <button
                      onClick={() => onDeleteReading && onDeleteReading(reading.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 transition shadow-2xs hover:shadow-xs cursor-pointer active:scale-95"
                      title="Mark this pothole as repaired/treated and delete location from database"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Mark Treated</span>
                    </button>
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
