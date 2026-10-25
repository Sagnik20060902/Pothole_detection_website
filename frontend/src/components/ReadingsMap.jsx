import React, { useEffect, useRef, useMemo, useState } from 'react';
import L from 'leaflet';
import { Locate, RotateCcw, CheckCircle2 } from 'lucide-react';
import { formatDate, formatCoordinates, getDepthSeverity, getSourceInfo } from '../utils/format';

const TILE_LAYERS = {
  light: {
    name: 'Clean Light',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: 'abcd',
  },
  osm: {
    name: 'Street Map',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    subdomains: 'abc',
  },
  satellite: {
    name: 'Satellite View',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; DigitalGlobe, GeoEye, Earthstar',
    subdomains: '',
  },
};

export default function ReadingsMap({ readings = [], onDeleteReading }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const layerGroupRef = useRef(null);
  const initialBoundsSetRef = useRef(false);

  const [activeStyle, setActiveStyle] = useState('light');

  // Expose delete handler to window for Leaflet popup button clicks
  useEffect(() => {
    window.__handleDeletePotholeFromMap = (id) => {
      if (onDeleteReading) {
        onDeleteReading(id);
      }
    };
    return () => {
      delete window.__handleDeletePotholeFromMap;
    };
  }, [onDeleteReading]);

  // Filter out invalid coordinates
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
      // Default initial center
      const initialCenter = [22.5726, 88.3639];
      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: 13,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomleft' }).addTo(map);

      tileLayerRef.current = L.tileLayer(TILE_LAYERS.light.url, {
        attribution: TILE_LAYERS.light.attribution,
        subdomains: TILE_LAYERS.light.subdomains,
        maxZoom: 19,
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

  // Handle Layer Switching
  const handleStyleChange = (key) => {
    setActiveStyle(key);
    const map = mapInstanceRef.current;
    if (!map || !TILE_LAYERS[key]) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    tileLayerRef.current = L.tileLayer(TILE_LAYERS[key].url, {
      attribution: TILE_LAYERS[key].attribution,
      subdomains: TILE_LAYERS[key].subdomains,
      maxZoom: 19,
    }).addTo(map);
  };

  // Update Route Polyline & Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    if (validReadings.length === 0) return;

    const latLngs = validReadings.map(r => [r.latitude, r.longitude]);

    // Draw emerald green connected polyline route
    if (latLngs.length > 1) {
      // Glow underlayer
      L.polyline(latLngs, {
        color: '#10b981',
        weight: 6,
        opacity: 0.3,
        smoothFactor: 1.0,
      }).addTo(layerGroup);

      // Core crisp green route line
      L.polyline(latLngs, {
        color: '#059669',
        weight: 3,
        opacity: 0.9,
        dashArray: '6, 6',
        smoothFactor: 1.0,
      }).addTo(layerGroup);
    }

    // Plot markers
    validReadings.forEach((reading) => {
      const depth = reading.pothole_depth ?? reading.particle_depth ?? 0;
      const severity = getDepthSeverity(depth);
      const sourceInfo = getSourceInfo(reading.source);
      const radius = depth >= 14 ? 8 : depth >= 7 ? 6.5 : 5;

      const circle = L.circleMarker([reading.latitude, reading.longitude], {
        radius: radius,
        fillColor: severity.strokeColor,
        fillOpacity: 0.95,
        color: '#ffffff',
        weight: 2,
      });

      const popupHtml = `
        <div style="font-family: inherit; min-width: 210px; padding: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 6px;">
            <span style="font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 9999px;" class="${severity.colorClass}">
              ${severity.label}
            </span>
            <span style="font-family: monospace; font-size: 11px; color: #64748b; font-weight: 700;">#${reading.id || ''}</span>
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 4px; font-size: 12px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748b;">Pothole Depth:</span>
              <strong style="color: #0f172a; font-size: 13px;">${depth.toFixed(1)} cm</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748b;">Source:</span>
              <span style="font-weight: 600; color: #059669;">${sourceInfo.label}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748b;">Sensors:</span>
              <span style="color: #334155; font-size: 11px;">HC-SR04 &bull; Neo-6M GPS</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748b;">Location:</span>
              <span style="font-family: monospace; font-size: 11px; color: #0f172a;">${formatCoordinates(reading.latitude, reading.longitude)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748b;">Recorded:</span>
              <span style="font-size: 11px; color: #64748b;">${formatDate(reading.sensor_timestamp)}</span>
            </div>
          </div>

          <button
            onclick="window.__handleDeletePotholeFromMap(${reading.id})"
            style="width: 100%; margin-top: 10px; padding: 6px 10px; background-color: #059669; color: #ffffff; border: none; border-radius: 8px; font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.1);"
            onmouseover="this.style.backgroundColor='#047857'"
            onmouseout="this.style.backgroundColor='#059669'"
          >
            <span>✓ Mark as Treated (Delete Point)</span>
          </button>
        </div>
      `;

      circle.bindPopup(popupHtml);
      circle.addTo(layerGroup);
    });

    // Auto-fit bounds on initial load
    if (!initialBoundsSetRef.current && validReadings.length > 0) {
      const bounds = L.latLngBounds(latLngs);
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
        initialBoundsSetRef.current = true;
      }
    }
  }, [validReadings]);

  // Recenter Map
  const handleRecenter = () => {
    const map = mapInstanceRef.current;
    if (!map || validReadings.length === 0) return;
    const latLngs = validReadings.map(r => [r.latitude, r.longitude]);
    const bounds = L.latLngBounds(latLngs);
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
  };

  return (
    <div className="relative isolate z-0 w-full h-[520px] rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">
      
      {/* Leaflet Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Top Left: Map Style Layer Switcher */}
      <div className="absolute top-4 left-4 z-10 flex items-center bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl p-1 shadow-md">
        {Object.entries(TILE_LAYERS).map(([key, style]) => (
          <button
            key={key}
            onClick={() => handleStyleChange(key)}
            className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition cursor-pointer ${
              activeStyle === key
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {style.name}
          </button>
        ))}
      </div>

      {/* Top Right: Recenter Button */}
      {validReadings.length > 0 && (
        <button
          onClick={handleRecenter}
          title="Recenter Map View"
          className="absolute top-4 right-4 z-10 bg-white/95 hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold shadow-md backdrop-blur-md flex items-center gap-2 transition cursor-pointer active:scale-95"
        >
          <Locate className="w-4 h-4 text-emerald-600" />
          <span>Recenter Route</span>
        </button>
      )}

      {/* Empty State Overlay */}
      {validReadings.length === 0 && (
        <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center pointer-events-none">
          <div className="p-4 rounded-full bg-emerald-50 border border-emerald-200 mb-3 shadow-sm text-emerald-600">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">All Potholes Treated</h3>
          <p className="text-xs text-slate-500 max-w-sm">
            0 active potholes in the database. When the ESP32 or manual upload logs new points, they will appear here.
          </p>
        </div>
      )}

      {/* Bottom Right: Map Legend Overlay */}
      <div className="absolute bottom-4 right-4 z-10 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-3.5 text-xs text-slate-700 shadow-md space-y-1.5 pointer-events-auto">
        <div className="font-bold text-slate-900 uppercase tracking-wider text-[10px] mb-1">
          Severity Scale
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block shadow-xs" />
          <span className="text-[11px] font-medium text-slate-700">Severe (&ge; 14 cm)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block shadow-xs" />
          <span className="text-[11px] font-medium text-slate-700">Moderate (7 - 14 cm)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block shadow-xs" />
          <span className="text-[11px] font-medium text-slate-700">Minor (&lt; 7 cm)</span>
        </div>
      </div>

    </div>
  );
}
