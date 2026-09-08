import React from 'react';
import { Activity, ShieldAlert, Upload, RefreshCw, Layers } from 'lucide-react';

export default function StatsHeader({ totalPoints, maxDepth, onRefresh, onOpenUploader, loading }) {
  return (
    <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-xl sticky top-0 z-20 px-6 py-5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        
        {/* Title / Branding */}
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
                Pothole Detection Dashboard
                <span className="text-xs font-normal uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  ESP32 Sync
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Geotagged road surface anomaly and pothole depth logging
              </p>
            </div>
          </div>
        </div>

        {/* Primary Stats Display */}
        <div className="flex items-center gap-8 bg-slate-900/90 border border-slate-800 rounded-xl px-6 py-3 shadow-inner">
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-slate-800/80 text-cyan-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
                Total Potholes
              </span>
              <span className="text-2xl font-light tracking-tight text-white font-mono">
                {loading ? '...' : totalPoints.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="h-9 w-px bg-slate-800" />

          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
                Max Depth Detected
              </span>
              <span className="text-2xl font-light tracking-tight text-white font-mono flex items-baseline gap-1">
                {loading ? '...' : maxDepth > 0 ? maxDepth.toFixed(1) : '0.0'}
                <span className="text-xs text-rose-400 font-sans">cm</span>
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition disabled:opacity-50 cursor-pointer"
            title="Refresh readings from server"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={onOpenUploader}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40 transition cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Batch Dump</span>
          </button>
        </div>

      </div>
    </header>
  );
}
