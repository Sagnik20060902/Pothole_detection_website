import React, { useState } from 'react';
import { X, Upload, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { uploadReadingsBatch } from '../api/readings';

export default function BatchUploader({ isOpen, onClose, onSuccess }) {
  const [jsonInput, setJsonInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  if (!isOpen) return null;

  // Generate realistic sample JSON batch payload
  const handleGenerateSample = () => {
    const now = new Date();
    const sampleData = [];
    let lat = 37.7749;
    let lng = -122.4194;

    for (let i = 0; i < 20; i++) {
      lat += (Math.random() * 0.0006) + 0.0002;
      lng += (Math.random() * 0.0008) - 0.0004;
      const pointTime = new Date(now.getTime() - (20 - i) * 45000);
      
      const depth = Number((Math.random() * 22.0 + 1.5).toFixed(1));
      
      sampleData.push({
        latitude: Number(lat.toFixed(6)),
        longitude: Number(lng.toFixed(6)),
        pothole_depth: depth,
        sensor_timestamp: pointTime.toISOString(),
      });
    }

    setJsonInput(JSON.stringify(sampleData, null, 2));
    setStatusMessage({ type: 'info', text: 'Generated 20 sample pothole reading points.' });
  };

  const parseInput = (rawText) => {
    const trimmed = rawText.trim();
    if (!trimmed) throw new Error('Input is empty.');

    // 1. Try standard JSON parse
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch (e) {
        // Fall through to plain text parsing if JSON parse failed
      }
    }

    // 2. CSV / Serial Monitor text parser
    const lines = trimmed.split('\n').filter(l => l.trim().length > 0);
    const readings = [];
    const now = new Date();

    lines.forEach((line, index) => {
      // Ignore header lines like "latitude,longitude,depth"
      if (index === 0 && (line.toLowerCase().includes('lat') && line.toLowerCase().includes('lng'))) {
        return;
      }

      // Extract numbers (floating point and integers)
      const numbers = line.match(/[-+]?\d*\.?\d+/g);
      if (numbers && numbers.length >= 3) {
        const lat = parseFloat(numbers[0]);
        const lng = parseFloat(numbers[1]);
        const depth = parseFloat(numbers[2]);

        if (!isNaN(lat) && !isNaN(lng) && !isNaN(depth)) {
          // Check if there's an ISO timestamp string on the line
          const isoMatch = line.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
          const timestamp = isoMatch ? isoMatch[0] : new Date(now.getTime() - (lines.length - index) * 1000).toISOString();

          readings.push({
            latitude: lat,
            longitude: lng,
            pothole_depth: depth,
            sensor_timestamp: timestamp,
          });
        }
      }
    });

    if (readings.length === 0) {
      throw new Error('Could not extract valid (Latitude, Longitude, Depth) readings from input.');
    }

    return readings;
  };

  const handleUpload = async () => {
    setStatusMessage(null);
    if (!jsonInput.trim()) {
      setStatusMessage({ type: 'error', text: 'Please paste JSON, CSV, or Serial output data.' });
      return;
    }

    try {
      const parsedReadings = parseInput(jsonInput);
      setUploading(true);
      const res = await uploadReadingsBatch(parsedReadings);
      const count = Array.isArray(res) ? res.length : 1;
      setStatusMessage({ type: 'success', text: `Successfully synced ${count} readings to database!` });
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err) {
      const errorMsg = err.message || err.response?.data?.detail || 'Upload failed.';
      setStatusMessage({ type: 'error', text: `Parse/Upload failed: ${errorMsg}` });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2 text-slate-100 font-semibold">
            <Upload className="w-4 h-4 text-emerald-400" />
            <span>ESP32 Batch Dump Ingestion</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Paste Data (JSON, CSV, or Raw Serial Logs)
            </label>
            <button
              onClick={handleGenerateSample}
              className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-medium transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate Sample Payload</span>
            </button>
          </div>

          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            rows={10}
            placeholder={`Supports 3 formats:\n\n1. Simple CSV / Comma Separated (lat, lng, depth):\n   22.5726, 88.3639, 14.2\n   22.5730, 88.3645, 18.5\n\n2. Serial Monitor Logs:\n   LAT: 22.5726, LNG: 88.3639, DEPTH: 14.2\n\n3. JSON Array:\n   [{"latitude": 22.5726, "longitude": 88.3639, "pothole_depth": 14.2}]`}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-200 focus:outline-none focus:border-cyan-500 transition shadow-inner resize-none"
          />

          {statusMessage && (
            <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
              statusMessage.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' :
              statusMessage.type === 'error' ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400' :
              'bg-cyan-500/10 border border-cyan-500/30 text-cyan-400'
            }`}>
              {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{statusMessage.text}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs text-slate-300 hover:bg-slate-800 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition disabled:opacity-50 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{uploading ? 'Ingesting Batch...' : 'Submit Batch Payload'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
