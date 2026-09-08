import React, { useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import { formatDate, formatCoordinates, getDepthSeverity } from '../utils/format';

export default function ReadingsMap({ readings = [] }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layerGroupRef = useRef(null);

  // Filter out invalid coordinates (0,0 or out of bound lat/lng)
  const validReadings = useMemo(() => {
    return readings.filter(r => (
      typeof r.latitude === 'number' &&
      typeof r.longitude === 'number' &&
      (r.latitude !== 0 || r.longitude !== 0) &&
      r.latitude >= -90 && r.latitude <= 90 &&
      r.longitude >= -180 && r.longitude <= 180
    ));
  }, [readings]);

  // Initialize Leaflet Map once
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [37.7749, -122.4194],
        zoom: 13,
        scrollWheelZoom: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        className: 'dark-tiles',
      }).addTo(map);

      layerGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Polyline, Markers, and Bounds whenever validReadings change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;

    if (!map || !layerGroup) return;

    // Clear previous markers & polylines
    layerGroup.clearLayers();

    if (validReadings.length === 0) return;

    const latLngs = validReadings.map(r => [r.latitude, r.longitude]);

    // Draw route polyline if > 1 point
    if (latLngs.length > 1) {
      L.polyline(latLngs, {
        color: '#38bdf8',
        weight: 3,
        opacity: 0.75,
        dashArray: '6, 6',
      }).addTo(layerGroup);
    }

    // Add individual markers with custom popup
    validReadings.forEach((reading) => {
      const depth = reading.pothole_depth ?? reading.particle_depth ?? 0;
      const severity = getDepthSeverity(depth);
      const radius = depth >= 14 ? 8 : depth >= 7 ? 6 : 4;

      const circle = L.circleMarker([reading.latitude, reading.longitude], {
        radius: radius,
        fillColor: severity.strokeColor,
        fillOpacity: 0.9,
        color: '#ffffff',
        weight: 1.5,
      });

      const popupContent = `
        <div class="p-1 min-w-[200px] text-xs font-sans space-y-2">
          <div class="flex items-center justify-between border-b border-slate-700/80 pb-2">
            <span class="px-2 py-0.5 rounded font-semibold text-[10px] ${severity.colorClass}">
              ${severity.label}
            </span>
            <span class="font-mono text-slate-400">#${reading.id || ''}</span>
          </div>
          <div class="space-y-1 pt-1">
            <div class="flex justify-between items-baseline">
              <span class="text-slate-400">Pothole Depth:</span>
              <span class="font-mono text-base font-bold text-slate-100">
                ${depth.toFixed(1)} <span class="text-xs text-rose-400 font-sans">cm</span>
              </span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">Location:</span>
              <span class="font-mono text-[11px] text-slate-200">
                ${formatCoordinates(reading.latitude, reading.longitude)}
              </span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">Recorded:</span>
              <span class="text-[11px] text-slate-300">
                ${formatDate(reading.sensor_timestamp)}
              </span>
            </div>
          </div>
        </div>
      `;

      circle.bindPopup(popupContent);
      circle.addTo(layerGroup);
    });

    // Auto-fit map bounds
    const bounds = L.latLngBounds(latLngs);
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
  }, [validReadings]);

  return (
    <div className="relative w-full h-[520px] rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Map Legend Overlay */}
      <div className="absolute bottom-4 right-4 z-[1000] bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-lg p-3 text-xs text-slate-300 shadow-xl space-y-1.5 pointer-events-auto">
        <div className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] mb-1">
          Severity Scale
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
          <span>Severe (&ge; 14 cm)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
          <span>Moderate (7 – 13.9 cm)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
          <span>Minor (&lt; 7 cm)</span>
        </div>
      </div>
    </div>
  );
}
