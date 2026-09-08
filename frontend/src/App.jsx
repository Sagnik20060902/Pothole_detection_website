import React, { useState, useEffect, useMemo, useCallback } from 'react';
import StatsHeader from './components/StatsHeader';
import ReadingsMap from './components/ReadingsMap';
import ReadingsTable from './components/ReadingsTable';
import BatchUploader from './components/BatchUploader';
import { fetchReadings } from './api/readings';
import { AlertTriangle, MapPin } from 'lucide-react';

export default function App() {
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploaderOpen, setUploaderOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchReadings();
      setReadings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load readings:', err);
      setError(err.message || 'Failed to connect to backend REST API');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived stats calculated via useMemo
  const totalPoints = useMemo(() => readings.length, [readings]);

  const maxDepth = useMemo(() => {
    if (readings.length === 0) return 0;
    return Math.max(...readings.map(r => r.pothole_depth ?? r.particle_depth ?? 0));
  }, [readings]);

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* Top Header */}
      <StatsHeader
        totalPoints={totalPoints}
        maxDepth={maxDepth}
        onRefresh={loadData}
        onOpenUploader={() => setUploaderOpen(true)}
        loading={loading}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-8">
        
        {/* API Error Notification */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <div className="text-xs">
                <span className="font-semibold block">API Connection Error</span>
                <span className="text-rose-400/90">{error}. Ensure Django server is running on http://127.0.0.1:8000.</span>
              </div>
            </div>
            <button
              onClick={loadData}
              className="px-3 py-1.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-medium border border-rose-500/40 transition cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Section 1: Map View */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-400" />
              Geospatial Coverage & Route Path
            </h2>
            <span className="text-xs text-slate-500">
              Connected sequence of geotagged field readings
            </span>
          </div>

          <ReadingsMap readings={readings} />
        </section>

        {/* Section 2: Raw Data Log Table */}
        <section className="space-y-3 pt-4">
          <ReadingsTable readings={readings} loading={loading} />
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            Pothole Detection System &bull; Offline ESP32 Geotagged Sensor Sync
          </div>
          <div className="text-slate-600 font-mono text-[11px]">
            Stateless REST API &bull; Leaflet &bull; React &bull; DRF
          </div>
        </div>
      </footer>

      {/* Batch Ingestion Modal */}
      <BatchUploader
        isOpen={uploaderOpen}
        onClose={() => setUploaderOpen(false)}
        onSuccess={loadData}
      />

    </div>
  );
}
