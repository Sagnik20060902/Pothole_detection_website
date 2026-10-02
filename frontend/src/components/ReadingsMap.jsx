import React, { useEffect, useRef, useMemo, useState } from 'react';
import L from 'leaflet';
import { Locate, RotateCcw, Layers } from 'lucide-react';
import { formatDate, formatCoordinates, getDepthSeverity } from '../utils/format';

const TILE_LAYERS = {
  dark: {
    name: 'CartoDB Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: 'abcd',
  },
  osm: {
    name: 'Standard OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    subdomains: 'abc',
  },
  satellite: {
    name: 'Esri Satellite Imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    subdomains: '',
  },
};

export default function ReadingsMap({ readings = [] }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const layerGroupRef = useRef(null);
  const initialBoundsSetRef = useRef(false);

  const [activeStyle, setActiveStyle] = useState('dark');

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
        center: [22.5726, 88.3639],
        zoom: 13,
        scrollWheelZoom: true,
        dragging: true,
        touchZoom: true,
        doubleClickZoom: true,
        zoomControl: true,
      });

      const initialTileConfig = TILE_LAYERS.dark;
      const tileLayer = L.tileLayer(initialTileConfig.url, {
        attribution: initialTileConfig.attribution,
        subdomains: initialTileConfig.subdomains,
        maxZoom: 19,
      }).addTo(map);

      tileLayerRef.current = tileLayer;
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

  // Change Map Tile Style dynamically (Free, 0 API key required)
  const handleStyleChange = (styleKey) => {
    setActiveStyle(styleKey);
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const config = TILE_LAYERS[styleKey];
    const newTileLayer = L.tileLayer(config.url, {
      attribution: config.attribution,
      subdomains: config.subdomains,
      maxZoom: 19,
    }).addTo(map);

    tileLayerRef.current = newTileLayer;
  };

  // Update Markers & Polyline smoothly WITHOUT yanking user zoom/pan
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
        color: '#06b6d4',
        weight: 3.5,
        opacity: 0.85,
        dashArray: '8, 6',
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

    // Auto-fit bounds ONLY ON INITIAL LOAD
    if (!initialBoundsSetRef.current && validReadings.length > 0) {
      const bounds = L.latLngBounds(latLngs);
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
        initialBoundsSetRef.current = true;
      }
    }
  }, [validReadings]);

  // Recenter map button handler
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
    <div className="relative w-full h-[540px] rounded-2xl overflow-hidden border border-slate-800/80 bg-[#0d1117] shadow-2xl">
      
      {/* Map Element */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Top Left: Free Map Style Layer Switcher (0 API Key Required) */}
      <div className="absolute top-4 left-14 z-[1000] flex items-center bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl p-1 shadow-xl">
        {Object.entries(TILE_LAYERS).map(([key, style]) => (
          <button
            key={key}
            onClick={() => handleStyleChange(key)}
            className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition cursor-pointer ${
              activeStyle === key
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            {style.name}
          </button>
        ))}
      </div>

      {/* Top Right: Floating Recenter Map Button */}
      {validReadings.length > 0 && (
        <button
          onClick={handleRecenter}
          title="Recenter Map View"
          className="absolute top-4 right-4 z-[1000] bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs font-semibold shadow-xl backdrop-blur-md flex items-center gap-2 transition cursor-pointer active:scale-95"
        >
          <Locate className="w-4 h-4 text-cyan-400" />
          <span>Recenter Route</span>
        </button>
      )}

      {/* Empty State Overlay */}
      {validReadings.length === 0 && (
        <div className="absolute inset-0 z-[1000] bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center pointer-events-none">
          <div className="p-4 rounded-full bg-slate-900 border border-slate-800 mb-3 shadow-inner">
            <RotateCcw className="w-8 h-8 text-cyan-400 animate-spin-slow" />
          </div>
          <h3 className="text-base font-bold text-slate-100 mb-1">No Geotagged Potholes Recorded</h3>
          <p className="text-xs text-slate-400 max-w-sm">
            Database is currently clean (0 points). Start your ESP32 device or upload readings to view live route markers.
          </p>
        </div>
      )}

      {/* Bottom Right: Map Legend Overlay */}
      <div className="absolute bottom-4 right-4 z-[1000] bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-3.5 text-xs text-slate-300 shadow-xl space-y-1.5 pointer-events-auto">
        <div className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] mb-1">
          Severity Scale
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
          <span>Severe (&ge; 14 cm)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
          <span>Moderate (7 &ndash; 13.9 cm)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
          <span>Minor (&lt; 7 cm)</span>
        </div>
      </div>

    </div>
  );
}
