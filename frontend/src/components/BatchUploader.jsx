import React, { useState } from 'react';
import { X, Upload, Sparkles, CheckCircle2, AlertCircle, PlusCircle, FileText } from 'lucide-react';
import { uploadReadingsBatch } from '../api/readings';

export default function BatchUploader({ isOpen, onClose, onSuccess }) {
  const [activeTab, setActiveTab] = useState('single'); // 'single' or 'batch'
  
  // Single reading form state
  const [singleLat, setSingleLat] = useState('22.5726');
  const [singleLng, setSingleLng] = useState('88.3639');
  const [singleDepth, setSingleDepth] = useState('14.2');

  // Batch payload state
  const [jsonInput, setJsonInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  if (!isOpen) return null;

  // Generate sample batch payload
  const handleGenerateSample = () => {
    const now = new Date();
    const sampleData = [];
    let lat = 22.5726;
    let lng = 88.3639;

    for (let i = 0; i < 10; i++) {
      lat += (Math.random() * 0.0006) + 0.0002;
      lng += (Math.random() * 0.0008) - 0.0004;
      const pointTime = new Date(now.getTime() - (10 - i) * 30000);
      const depth = Number((Math.random() * 22.0 + 1.5).toFixed(1));
      
      sampleData.push({
        latitude: Number(lat.toFixed(6)),
        longitude: Number(lng.toFixed(6)),
        pothole_depth: depth,
        sensor_timestamp: pointTime.toISOString(),
      });
    }

    setJsonInput(JSON.stringify(sampleData, null, 2));
    setStatusMessage({ type: 'info', text: 'Generated 10 sample pothole reading points.' });
  };

  const parseBatchInput = (rawText) => {
    const trimmed = rawText.trim();
    if (!trimmed) throw new Error('Input is empty.');

    // 1. Standard JSON parse
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch (e) {
        // Fallback to plain text parsing
      }
    }

    // 2. CSV / Serial text parser
    const lines = trimmed.split('\n').filter(l => l.trim().length > 0);
    const readings = [];
    const now = new Date();

    lines.forEach((line, index) => {
      if (index === 0 && (line.toLowerCase().includes('lat') && line.toLowerCase().includes('lng'))) {
        return;
      }

      const numbers = line.match(/[-+]?\d*\.?\d+/g);
      if (numbers && numbers.length >= 3) {
        const lat = parseFloat(numbers[0]);
        const lng = parseFloat(numbers[1]);
        const depth = parseFloat(numbers[2]);

        if (!isNaN(lat) && !isNaN(lng) && !isNaN(depth)) {
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
      throw new Error('Could not extract valid (Latitude, Longitude, Depth) numbers from input.');
    }

    return readings;
  };

  const handleSingleSubmit = async (e) => {
    e.preventDefault();
    setStatusMessage(null);

    const lat = parseFloat(singleLat);
    const lng = parseFloat(singleLng);
    const depth = parseFloat(singleDepth);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      setStatusMessage({ type: 'error', text: 'Latitude must be between -90 and 90.' });
      return;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      setStatusMessage({ type: 'error', text: 'Longitude must be between -180 and 180.' });
      return;
    }
    if (isNaN(depth) || depth < 0) {
      setStatusMessage({ type: 'error', text: 'Pothole depth must be a positive number.' });
      return;
    }

    try {
      setUploading(true);
      const payload = [{
        latitude: lat,
        longitude: lng,
        pothole_depth: depth,
        sensor_timestamp: new Date().toISOString()
      }];

      await uploadReadingsBatch(payload);
      setStatusMessage({ type: 'success', text: `Successfully added pothole at (${lat}, ${lng})!` });
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1000);
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to submit reading.' });
    } finally {
      setUploading(false);
    }
  };

  const handleBatchSubmit = async () => {
    setStatusMessage(null);
    if (!jsonInput.trim()) {
      setStatusMessage({ type: 'error', text: 'Please paste JSON, CSV, or Serial output data.' });
      return;
    }

    try {
      const parsedReadings = parseBatchInput(jsonInput);
      setUploading(true);
      const res = await uploadReadingsBatch(parsedReadings);
      const count = Array.isArray(res) ? res.length : 1;
      setStatusMessage({ type: 'success', text: `Successfully synced ${count} readings to database!` });
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1000);
    } catch (err) {
      const errorMsg = err.message || err.response?.data?.detail || 'Upload failed.';
      setStatusMessage({ type: 'error', text: `Parse/Upload failed: ${errorMsg}` });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2 text-slate-100 font-semibold">
            <Upload className="w-4 h-4 text-cyan-400" />
            <span>Add Geotagged Pothole Data</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 p-1 gap-1 px-6 pt-3">
          <button
            onClick={() => { setActiveTab('single'); setStatusMessage(null); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-2 ${
              activeTab === 'single'
                ? 'bg-slate-800 text-cyan-400 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Single Pothole</span>
          </button>

          <button
            onClick={() => { setActiveTab('batch'); setStatusMessage(null); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-2 ${
              activeTab === 'batch'
                ? 'bg-slate-800 text-cyan-400 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Paste Batch (CSV / Serial / JSON)</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-4">
          
          {/* TAB 1: Single Form Input */}
          {activeTab === 'single' && (
            <form onSubmit={handleSingleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={singleLat}
                    onChange={(e) => setSingleLat(e.target.value)}
                    placeholder="e.g. 22.572645"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 font-mono text-xs text-slate-100 focus:outline-none focus:border-cyan-500 transition shadow-inner"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={singleLng}
                    onChange={(e) => setSingleLng(e.target.value)}
                    placeholder="e.g. 88.363892"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 font-mono text-xs text-slate-100 focus:outline-none focus:border-cyan-500 transition shadow-inner"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Pothole Depth (cm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="100"
                  value={singleDepth}
                  onChange={(e) => setSingleDepth(e.target.value)}
                  placeholder="e.g. 14.5"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 font-mono text-xs text-slate-100 focus:outline-none focus:border-cyan-500 transition shadow-inner"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={uploading}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>{uploading ? 'Adding Pothole...' : 'Save Pothole Reading'}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: Batch Raw Paste Input */}
          {activeTab === 'batch' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Paste Raw Data (CSV, Serial Logs, or JSON)
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
                rows={7}
                placeholder={`Paste any of these 3 formats:\n\n1. Simple CSV (lat, lng, depth):\n   22.5726, 88.3639, 14.2\n\n2. Serial Logs:\n   LAT: 22.5726, LNG: 88.3639, DEPTH: 14.2\n\n3. JSON:\n   [{"latitude": 22.5726, "longitude": 88.3639, "pothole_depth": 14.2}]`}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 font-mono text-xs text-slate-200 focus:outline-none focus:border-cyan-500 transition shadow-inner resize-none"
              />

              <div className="flex justify-end">
                <button
                  onClick={handleBatchSubmit}
                  disabled={uploading}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition disabled:opacity-50 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>{uploading ? 'Ingesting Batch...' : 'Submit Batch Payload'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Status Alert */}
          {statusMessage && (
            <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              statusMessage.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' :
              statusMessage.type === 'error' ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400' :
              'bg-cyan-500/10 border border-cyan-500/30 text-cyan-400'
            }`}>
              {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{statusMessage.text}</span>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
