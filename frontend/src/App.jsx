import React, { useState, useEffect, useMemo, useCallback } from 'react';
import StatsHeader from './components/StatsHeader';
import ReadingsMap from './components/ReadingsMap';
import ReadingsTable from './components/ReadingsTable';
import ConnectionHubModal from './components/ConnectionHubModal';
import { fetchReadings, clearAllReadings, deleteReading } from './api/readings';
import { AlertTriangle, MapPin, Upload, Wifi, Usb, ChevronRight, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Ingestion Modal State
  const [hubOpen, setHubOpen] = useState(false);
  const [hubInitialTab, setHubInitialTab] = useState('manual');
  const [notification, setNotification] = useState(null);

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setError(null);
    try {
      const data = await fetchReadings();
      setReadings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load readings:', err);
      if (!isSilent) setError(err.message || 'Failed to connect to backend REST API');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  const handleOpenHub = (tab = 'manual') => {
    setHubInitialTab(tab);
    setHubOpen(true);
  };

  // Delete / Mark a single treated pothole
  const handleDeleteReading = async (id) => {
    if (window.confirm(`Mark Pothole #${id} as treated and remove its location from the map?`)) {
      try {
        await deleteReading(id);
        setNotification(`Pothole #${id} marked as treated and removed!`);
        setTimeout(() => setNotification(null), 3500);
        await loadData();
      } catch (err) {
        alert('Failed to remove reading: ' + (err.message || 'Unknown error'));
      }
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to delete all stored pothole readings from the database?')) {
      try {
        setLoading(true);
        await clearAllReadings();
        await loadData();
      } catch (err) {
        alert('Failed to clear database: ' + (err.message || 'Unknown error'));
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadData();
    
    // Auto-refresh every 3 seconds for live ESP32 WiFi / USB telemetry updates
    const interval = setInterval(() => {
      loadData(true);
    }, 3000);

    return () => clearInterval(interval);
  }, [loadData]);

  const totalPoints = useMemo(() => readings.length, [readings]);

  const maxDepth = useMemo(() => {
    if (readings.length === 0) return 0;
    return Math.max(...readings.map(r => r.pothole_depth ?? r.particle_depth ?? 0));
  }, [readings]);

  const sourceCounts = useMemo(() => {
    const counts = { manual: 0, wifi: 0, usb_serial: 0 };
    readings.forEach(r => {
      const src = (r.source || 'manual').toLowerCase();
      if (src === 'wifi') counts.wifi++;
      else if (src === 'usb_serial' || src === 'usb' || src === 'serial') counts.usb_serial++;
      else counts.manual++;
    });
    return counts;
  }, [readings]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-emerald-500/20 selection:text-emerald-900">
      
      {/* Top Header */}
      <StatsHeader
        totalPoints={totalPoints}
        maxDepth={maxDepth}
        sourceCounts={sourceCounts}
        onRefresh={loadData}
        onOpenUploader={handleOpenHub}
        onClearAll={handleClearAll}
        loading={loading}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 space-y-6">
        
        {/* Treatment Notification Toast */}
        {notification && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{notification}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-emerald-600 hover:text-emerald-800 font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* API Error Notification */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <div className="text-xs">
                <span className="font-bold block">API Connection Error</span>
                <span className="text-rose-700">{error}. Ensure Django server is running on http://127.0.0.1:8000.</span>
              </div>
            </div>
            <button
              onClick={loadData}
              className="px-3 py-1.5 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-semibold border border-rose-300 transition cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* 3 Ingestion Channels Banner / Selector */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Channel 1: Manual Upload */}
          <div
            onClick={() => handleOpenHub('manual')}
            className="p-5 rounded-2xl bg-white border border-slate-200/90 hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer group shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 group-hover:bg-emerald-50 group-hover:text-emerald-700 transition-colors">
                  <Upload className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  {sourceCounts.manual} Stored
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                Option 1: Manual Upload
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Add single readings, use browser GPS location, calculate depth from ultrasonic distance, or paste CSV/JSON files.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-emerald-700 font-bold">
              <span>Open Form &bull; Batch Dump</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Channel 2: WiFi Connection */}
          <div
            onClick={() => handleOpenHub('wifi')}
            className="p-5 rounded-2xl bg-white border border-slate-200/90 hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer group shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-colors">
                  <Wifi className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {sourceCounts.wifi} Stored
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                Option 2: WiFi (ESP Device)
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Wire ESP32 with Ultrasonic HC-SR04 &amp; Neo-6M GPS to stream live HTTP POST telemetry over your WiFi network.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-emerald-700 font-bold">
              <span>WiFi Setup &bull; Live Stream</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Channel 3: USB Cable */}
          <div
            onClick={() => handleOpenHub('usb')}
            className="p-5 rounded-2xl bg-white border border-slate-200/90 hover:border-teal-500 hover:shadow-md transition-all cursor-pointer group shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 rounded-xl bg-teal-50 text-teal-600 group-hover:bg-teal-100 group-hover:text-teal-700 transition-colors">
                  <Usb className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                  {sourceCounts.usb_serial} Stored
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-teal-700 transition-colors">
                Option 3: USB Cable (Serial)
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Connect ESP32 via USB cable. Browser Web Serial monitors live COM data &amp; ingests ultrasonic readings directly.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-teal-700 font-bold">
              <span>Web Serial &bull; Live Monitor</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

        </div>

        {/* Section 1: Map View */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-600" />
              Geospatial Route &amp; Pothole Defect Map
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              Click any marker on the map to view details and mark it as treated
            </span>
          </div>

          <ReadingsMap
            readings={readings}
            onDeleteReading={handleDeleteReading}
          />
        </section>

        {/* Section 2: Raw Data Log Table */}
        <section className="space-y-3 pt-2">
          <ReadingsTable
            readings={readings}
            loading={loading}
            onDeleteReading={handleDeleteReading}
          />
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-5 px-6 text-center text-xs text-slate-500 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            Pothole Detection &amp; Road Surface Quality System &bull; Clean White &amp; Green Theme
          </div>
          <div className="text-slate-500 font-mono text-[11px] font-semibold">
            Manual &bull; WiFi Telemetry &bull; USB Web Serial &bull; One-Click Pothole Repair Tracking
          </div>
        </div>
      </footer>

      {/* Connection & Ingestion Modal */}
      <ConnectionHubModal
        isOpen={hubOpen}
        initialTab={hubInitialTab}
        onClose={() => setHubOpen(false)}
        onSuccess={loadData}
      />

    </div>
  );
}
