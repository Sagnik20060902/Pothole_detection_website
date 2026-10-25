import React from 'react';
import { Activity, ShieldAlert, Upload, RefreshCw, Layers, Trash2, Wifi, Usb } from 'lucide-react';

export default function StatsHeader({
  totalPoints,
  maxDepth,
  sourceCounts = { manual: 0, wifi: 0, usb_serial: 0 },
  onRefresh,
  onOpenUploader,
  onClearAll,
  loading
}) {
  return (
    <header className="border-b border-emerald-100 bg-white/95 backdrop-blur-md sticky top-0 z-20 px-6 py-4 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        
        {/* Title / Branding */}
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 shadow-sm">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2">
                Pothole Detection &amp; Road Surface Dashboard
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  ESP32 &bull; Ultrasonic + Neo-6M GPS
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time road surface defect monitoring &amp; repair tracking
              </p>
            </div>
          </div>
        </div>

        {/* Primary Stats Display */}
        <div className="flex items-center gap-6 bg-slate-50 border border-slate-200/90 rounded-2xl px-5 py-2.5 shadow-inner">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-100/70 text-emerald-700">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Total Potholes
              </span>
              <span className="text-xl font-bold tracking-tight text-slate-900 font-mono">
                {loading ? '...' : totalPoints.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="h-8 w-px bg-slate-200" />

          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-200">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Max Depth
              </span>
              <span className="text-xl font-bold tracking-tight text-slate-900 font-mono flex items-baseline gap-1">
                {loading ? '...' : maxDepth > 0 ? maxDepth.toFixed(1) : '0.0'}
                <span className="text-[11px] text-rose-600 font-sans font-medium">cm</span>
              </span>
            </div>
          </div>

          <div className="h-8 w-px bg-slate-200 hidden sm:block" />

          {/* Sources breakdown pill */}
          <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono">
            <span className="px-2 py-0.5 rounded-md bg-white text-slate-700 border border-slate-200 font-medium shadow-2xs" title="Manual Uploads">
              Manual: {sourceCounts.manual}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold shadow-2xs" title="WiFi Telemetry">
              WiFi: {sourceCounts.wifi}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200 font-semibold shadow-2xs" title="USB Cable Serial">
              USB: {sourceCounts.usb_serial}
            </span>
          </div>
        </div>

        {/* 3 Ingestion Action Controls */}
        <div className="flex items-center flex-wrap gap-2">
          
          {/* Option 1: Manual Upload */}
          <button
            onClick={() => onOpenUploader('manual')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs transition cursor-pointer"
            title="Option 1: Add pothole data manually or batch dump"
          >
            <Upload className="w-3.5 h-3.5 text-slate-600" />
            <span>Manual Upload</span>
          </button>

          {/* Option 2: WiFi Connection */}
          <button
            onClick={() => onOpenUploader('wifi')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition cursor-pointer"
            title="Option 2: Connect ESP32 via WiFi HTTP telemetry"
          >
            <Wifi className="w-3.5 h-3.5 text-emerald-100" />
            <span>WiFi (ESP32)</span>
          </button>

          {/* Option 3: USB Cable */}
          <button
            onClick={() => onOpenUploader('usb')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-teal-50 hover:bg-teal-100/80 text-teal-800 border border-teal-200 transition cursor-pointer"
            title="Option 3: Connect ESP32 via USB cable (Web Serial)"
          >
            <Usb className="w-3.5 h-3.5 text-teal-600" />
            <span>USB Cable</span>
          </button>

          <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />

          {/* Refresh */}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 rounded-xl text-xs bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition disabled:opacity-50 cursor-pointer"
            title="Refresh database readings"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Clear All */}
          <button
            onClick={onClearAll}
            disabled={totalPoints === 0}
            className="p-2 rounded-xl text-xs bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition disabled:opacity-40 cursor-pointer"
            title="Clear all stored readings"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

        </div>

      </div>
    </header>
  );
}
