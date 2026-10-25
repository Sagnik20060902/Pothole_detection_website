import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  Wifi,
  Usb,
  PlusCircle,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Play,
  Square,
  Terminal,
  Navigation,
  Sliders,
  HardDrive
} from 'lucide-react';
import { uploadReadingsBatch } from '../api/readings';

export default function ConnectionHubModal({ isOpen, onClose, onSuccess, initialTab = 'manual' }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setStatusMessage(null);
    }
  }, [isOpen, initialTab]);

  const [statusMessage, setStatusMessage] = useState(null);
  const [uploading, setUploading] = useState(false);

  // TAB 1: MANUAL UPLOAD STATE
  const [manualSubMode, setManualSubMode] = useState('single');
  const [singleLat, setSingleLat] = useState('22.572645');
  const [singleLng, setSingleLng] = useState('88.363892');
  const [singleDepth, setSingleDepth] = useState('12.5');
  const [useUltrasonicCalc, setUseUltrasonicCalc] = useState(false);
  const [baselineClearance, setBaselineClearance] = useState('20.0');
  const [measuredEchoDistance, setMeasuredEchoDistance] = useState('32.5');

  const [batchRawInput, setBatchRawInput] = useState('');
  const [parsedPreviewCount, setParsedPreviewCount] = useState(null);

  const handleToggleUltrasonicCalc = (enabled) => {
    setUseUltrasonicCalc(enabled);
    if (enabled) {
      const base = parseFloat(baselineClearance) || 20.0;
      const measured = parseFloat(measuredEchoDistance) || 32.5;
      setSingleDepth(Math.max(0, measured - base).toFixed(1));
    }
  };

  const handleBaselineChange = (val) => {
    setBaselineClearance(val);
    const base = parseFloat(val) || 0;
    const measured = parseFloat(measuredEchoDistance) || 0;
    setSingleDepth(Math.max(0, measured - base).toFixed(1));
  };

  const handleMeasuredEchoChange = (val) => {
    setMeasuredEchoDistance(val);
    const base = parseFloat(baselineClearance) || 0;
    const measured = parseFloat(val) || 0;
    setSingleDepth(Math.max(0, measured - base).toFixed(1));
  };

  const handleGetBrowserLocation = () => {
    if (!navigator.geolocation) {
      setStatusMessage({ type: 'error', text: 'Geolocation is not supported by your browser.' });
      return;
    }
    setStatusMessage({ type: 'info', text: 'Fetching GPS coordinates from your device...' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSingleLat(pos.coords.latitude.toFixed(6));
        setSingleLng(pos.coords.longitude.toFixed(6));
        setStatusMessage({
          type: 'success',
          text: `Retrieved device coordinates: ${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`
        });
      },
      (err) => {
        setStatusMessage({ type: 'error', text: `Failed to acquire GPS: ${err.message}` });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleGenerateSample = () => {
    const now = new Date();
    const sampleData = [];
    let lat = 22.5726;
    let lng = 88.3639;

    for (let i = 0; i < 8; i++) {
      lat += (Math.random() * 0.0006) + 0.0002;
      lng += (Math.random() * 0.0008) - 0.0004;
      const pointTime = new Date(now.getTime() - (8 - i) * 20000);
      const depth = Number((Math.random() * 20.0 + 3.5).toFixed(1));

      sampleData.push({
        latitude: Number(lat.toFixed(6)),
        longitude: Number(lng.toFixed(6)),
        pothole_depth: depth,
        source: 'manual',
        sensor_timestamp: pointTime.toISOString(),
      });
    }

    const jsonStr = JSON.stringify(sampleData, null, 2);
    setBatchRawInput(jsonStr);
    setParsedPreviewCount(sampleData.length);
    setStatusMessage({ type: 'info', text: `Generated ${sampleData.length} sample pothole readings.` });
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setBatchRawInput(content);
        try {
          const parsed = parseBatchInput(content);
          setParsedPreviewCount(parsed.length);
          setStatusMessage({ type: 'success', text: `Loaded file "${file.name}" with ${parsed.length} readings!` });
        } catch (err) {
          setStatusMessage({ type: 'error', text: `File loaded but parse warning: ${err.message}` });
        }
      }
    };
    reader.readAsText(file);
  };

  const parseBatchInput = (rawText) => {
    const trimmed = rawText.trim();
    if (!trimmed) throw new Error('Input is empty.');

    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        return list.map(item => ({
          latitude: parseFloat(item.latitude),
          longitude: parseFloat(item.longitude),
          pothole_depth: parseFloat(item.pothole_depth ?? item.particle_depth),
          source: item.source || 'manual',
          sensor_timestamp: item.sensor_timestamp || new Date().toISOString()
        }));
      } catch (e) {
        // Fall back to lines parser
      }
    }

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
          readings.push({
            latitude: lat,
            longitude: lng,
            pothole_depth: depth,
            source: 'manual',
            sensor_timestamp: isoMatch ? isoMatch[0] : new Date(now.getTime() - (lines.length - index) * 1000).toISOString(),
          });
        }
      }
    });

    if (readings.length === 0) {
      throw new Error('Could not extract valid (Latitude, Longitude, Depth) readings from input.');
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
      setStatusMessage({ type: 'error', text: 'Pothole depth must be positive.' });
      return;
    }

    try {
      setUploading(true);
      const payload = [{
        latitude: lat,
        longitude: lng,
        pothole_depth: depth,
        source: 'manual',
        sensor_timestamp: new Date().toISOString()
      }];

      await uploadReadingsBatch(payload);
      setStatusMessage({ type: 'success', text: `Successfully saved pothole: Depth ${depth}cm at (${lat}, ${lng})!` });
      setTimeout(() => {
        onSuccess?.();
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
    try {
      const parsed = parseBatchInput(batchRawInput);
      setUploading(true);
      const res = await uploadReadingsBatch(parsed);
      const count = Array.isArray(res) ? res.length : 1;
      setStatusMessage({ type: 'success', text: `Successfully synced ${count} pothole readings to database!` });
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1100);
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message || 'Batch upload failed.' });
    } finally {
      setUploading(false);
    }
  };

  // TAB 2: WIFI STATE
  const [wifiSimulating, setWifiSimulating] = useState(false);
  const [wifiLogs, setWifiLogs] = useState([]);
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  const wifiSimIntervalRef = useRef(null);

  const apiEndpointUrl = `${window.location.protocol}//${window.location.hostname || '127.0.0.1'}:8000/api/readings/`;

  const handleCopyEndpoint = () => {
    navigator.clipboard.writeText(apiEndpointUrl);
    setCopiedEndpoint(true);
    setTimeout(() => setCopiedEndpoint(false), 2000);
  };

  const handleToggleWifiSimulation = () => {
    if (wifiSimulating) {
      clearInterval(wifiSimIntervalRef.current);
      setWifiSimulating(false);
      addWifiLog('[WIFI SIMULATOR] Stream paused by user.');
    } else {
      setWifiSimulating(true);
      addWifiLog('[WIFI SIMULATOR] Starting ESP32 WiFi Telemetry stream...');

      let lat = 22.5650;
      let lng = 88.3580;
      const baseline = 20.0;
      let count = 0;

      const pushPoint = async () => {
        count++;
        lat += 0.0003 + (Math.random() * 0.0002);
        lng += 0.0002 + (Math.random() * 0.0003);
        const echoDist = Number((baseline + Math.random() * 21.0 + 4.0).toFixed(1));
        const depth = Number((echoDist - baseline).toFixed(1));

        const payload = {
          latitude: Number(lat.toFixed(6)),
          longitude: Number(lng.toFixed(6)),
          pothole_depth: depth,
          source: 'wifi',
          sensor_timestamp: new Date().toISOString()
        };

        try {
          const res = await uploadReadingsBatch([payload]);
          const inserted = Array.isArray(res) ? res[0] : res;
          addWifiLog(`[HTTP 201 POST] WiFi Pothole #${inserted?.id || count} | Echo: ${echoDist}cm -> Depth: ${depth}cm | (${lat.toFixed(6)}, ${lng.toFixed(6)})`);
          onSuccess?.();
        } catch (err) {
          addWifiLog(`[HTTP POST FAILED] ${err.message}`);
        }
      };

      pushPoint();
      wifiSimIntervalRef.current = setInterval(pushPoint, 2500);
    }
  };

  const addWifiLog = (line) => {
    const time = new Date().toLocaleTimeString();
    setWifiLogs(prev => [...prev.slice(-30), `[${time}] ${line}`]);
  };

  useEffect(() => {
    return () => {
      if (wifiSimIntervalRef.current) clearInterval(wifiSimIntervalRef.current);
    };
  }, []);

  // TAB 3: USB CABLE STATE
  const [serialSupported, setSerialSupported] = useState(false);
  const [serialConnected, setSerialConnected] = useState(false);
  const [selectedBaud, setSelectedBaud] = useState(115200);
  const [serialLogs, setSerialLogs] = useState([]);
  const [serialPortInfo, setSerialPortInfo] = useState('');
  const [usbIngestedCount, setUsbIngestedCount] = useState(0);
  const [autoScrollSerial, setAutoScrollSerial] = useState(true);

  const portRef = useRef(null);
  const readerRef = useRef(null);
  const serialTerminalEndRef = useRef(null);

  useEffect(() => {
    setSerialSupported('serial' in navigator);
  }, []);

  useEffect(() => {
    if (autoScrollSerial && serialTerminalEndRef.current) {
      serialTerminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [serialLogs, autoScrollSerial]);

  const addSerialLog = (line) => {
    const time = new Date().toLocaleTimeString();
    setSerialLogs(prev => [...prev.slice(-50), `[${time}] ${line}`]);
  };

  const handleConnectUsb = async () => {
    if (!('serial' in navigator)) {
      alert('Web Serial API is not supported in this browser. Please use Google Chrome, Microsoft Edge, or run python usb_serial_bridge.py.');
      return;
    }

    try {
      addSerialLog('[USB] Requesting USB Serial port from browser...');
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: Number(selectedBaud) });

      portRef.current = port;
      setSerialConnected(true);
      const info = port.getInfo();
      const portLabel = info.usbVendorId ? `VID: 0x${info.usbVendorId.toString(16)} PID: 0x${info.usbProductId?.toString(16) || ''}` : 'USB Serial COM Device';
      setSerialPortInfo(portLabel);
      addSerialLog(`[USB CONNECTED] Connected to ${portLabel} at ${selectedBaud} baud.`);
      setStatusMessage({ type: 'success', text: `USB Device Connected! Streaming telemetry at ${selectedBaud} baud.` });

      readFromUsbPort(port);
    } catch (err) {
      addSerialLog(`[USB ERROR] Failed to connect: ${err.message}`);
      setStatusMessage({ type: 'error', text: `USB Connection failed: ${err.message}` });
    }
  };

  const handleDisconnectUsb = async () => {
    try {
      if (readerRef.current) {
        await readerRef.current.cancel();
      }
      if (portRef.current) {
        await portRef.current.close();
      }
    } catch (err) {
      console.warn('Error during USB disconnect:', err);
    } finally {
      portRef.current = null;
      readerRef.current = null;
      setSerialConnected(false);
      addSerialLog('[USB DISCONNECTED] Serial port closed.');
    }
  };

  const readFromUsbPort = async (port) => {
    const textDecoder = new TextDecoderStream();
    port.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();
    readerRef.current = reader;

    let buffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += value;
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine) continue;

            addSerialLog(`[RX] ${cleanLine}`);

            if (cleanLine.startsWith('{') && cleanLine.endsWith('}')) {
              try {
                const parsed = JSON.parse(cleanLine);
                if (parsed.latitude && parsed.longitude && (parsed.pothole_depth !== undefined || parsed.particle_depth !== undefined)) {
                  parsed.source = 'usb_serial';
                  parsed.sensor_timestamp = parsed.sensor_timestamp || new Date().toISOString();

                  const res = await uploadReadingsBatch([parsed]);
                  setUsbIngestedCount(c => c + 1);
                  addSerialLog(`==> [INGESTED VIA USB] Pothole #${res?.[0]?.id || 'OK'} Depth: ${parsed.pothole_depth}cm`);
                  onSuccess?.();
                }
              } catch (e) {
                // Not valid JSON
              }
            }
          }
        }
      }
    } catch (err) {
      if (!err.message.includes('cancel')) {
        addSerialLog(`[USB STREAM ERROR] ${err.message}`);
      }
    } finally {
      reader.releaseLock();
    }
  };

  const handleSimulateUsbPacket = async () => {
    const baseline = 20.0;
    const echo = Number((baseline + Math.random() * 18.0 + 3.0).toFixed(1));
    const depth = Number((echo - baseline).toFixed(1));
    const lat = Number((22.5580 + (Math.random() * 0.005)).toFixed(6));
    const lng = Number((88.3620 + (Math.random() * 0.005)).toFixed(6));

    const packet = {
      latitude: lat,
      longitude: lng,
      pothole_depth: depth,
      source: 'usb_serial',
      sensor_timestamp: new Date().toISOString()
    };

    const jsonLine = JSON.stringify(packet);
    addSerialLog(`[RX SIMULATED] ${jsonLine}`);
    addSerialLog(`[ULTRASONIC] Echo: ${echo}cm -> Pothole Depth: ${depth}cm`);

    try {
      const res = await uploadReadingsBatch([packet]);
      setUsbIngestedCount(c => c + 1);
      addSerialLog(`==> [INGESTED VIA USB] Pothole #${res?.[0]?.id || 'OK'} saved!`);
      setStatusMessage({ type: 'success', text: `Simulated USB pothole synced: ${depth}cm at (${lat}, ${lng})` });
      onSuccess?.();
    } catch (err) {
      addSerialLog(`[API ERROR] ${err.message}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700 shadow-2xs">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                Pothole Data Ingestion &amp; Device Hub
              </h2>
              <p className="text-[11px] text-slate-500">
                MPU6500 &bull; HC-SR04 Ultrasonic &bull; Neo-6M GPS Logging
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition p-1.5 rounded-lg hover:bg-slate-200/60 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Main Connection Tabs */}
        <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50 p-2 gap-2 px-6 shrink-0">
          
          <button
            onClick={() => { setActiveTab('manual'); setStatusMessage(null); }}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'manual'
                ? 'bg-white text-slate-900 border border-slate-200 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <Upload className="w-4 h-4 text-emerald-600" />
            <span>1. Manual Upload</span>
          </button>

          <button
            onClick={() => { setActiveTab('wifi'); setStatusMessage(null); }}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'wifi'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <Wifi className="w-4 h-4" />
            <span>2. WiFi (ESP32)</span>
          </button>

          <button
            onClick={() => { setActiveTab('usb'); setStatusMessage(null); }}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'usb'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <Usb className="w-4 h-4" />
            <span>3. USB Cable</span>
          </button>

        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-white">
          
          {/* TAB 1: MANUAL */}
          {activeTab === 'manual' && (
            <div className="space-y-4">
              
              <div className="flex bg-slate-100 p-1 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => setManualSubMode('single')}
                  className={`flex-1 py-1.5 rounded-lg font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    manualSubMode === 'single'
                      ? 'bg-white text-emerald-800 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Single Pothole Form</span>
                </button>
                <button
                  type="button"
                  onClick={() => setManualSubMode('batch')}
                  className={`flex-1 py-1.5 rounded-lg font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    manualSubMode === 'batch'
                      ? 'bg-white text-emerald-800 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Batch Dump / File Upload</span>
                </button>
              </div>

              {manualSubMode === 'single' && (
                <form onSubmit={handleSingleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                        Latitude
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={singleLat}
                        onChange={(e) => setSingleLat(e.target.value)}
                        placeholder="e.g. 22.572645"
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                        Longitude
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={singleLng}
                        onChange={(e) => setSingleLng(e.target.value)}
                        placeholder="e.g. 88.363892"
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSingleLat('22.572645');
                          setSingleLng('88.363892');
                          setSingleDepth('12.5');
                          setStatusMessage({ type: 'info', text: 'Filled sample coordinates (Kolkata).' });
                        }}
                        className="text-slate-600 hover:text-slate-900 font-medium underline underline-offset-2 cursor-pointer"
                      >
                        Fill Sample
                      </button>
                      <span className="text-slate-300">&bull;</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSingleLat('');
                          setSingleLng('');
                          setSingleDepth('');
                          setStatusMessage(null);
                        }}
                        className="text-slate-500 hover:text-rose-600 font-medium cursor-pointer"
                      >
                        Clear Fields
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleGetBrowserLocation}
                      className="font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>Use My Device's Current GPS Location</span>
                    </button>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-emerald-700" />
                        <span className="text-xs font-bold text-emerald-900">
                          Ultrasonic Sensor (HC-SR04) Assistant
                        </span>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 font-medium">
                        <input
                          type="checkbox"
                          checked={useUltrasonicCalc}
                          onChange={(e) => handleToggleUltrasonicCalc(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>Calculate depth from echo distance</span>
                      </label>
                    </div>

                    {useUltrasonicCalc && (
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-emerald-100">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">
                            Road Baseline Clearance (cm)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={baselineClearance}
                            onChange={(e) => handleBaselineChange(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-xs text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">
                            Ultrasonic Measured Distance (cm)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={measuredEchoDistance}
                            onChange={(e) => handleMeasuredEchoChange(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono text-xs text-slate-900"
                          />
                        </div>
                        <div className="col-span-2 text-[11px] text-emerald-900 bg-white p-2 rounded-lg font-mono border border-emerald-100">
                          Pothole Depth = Measured ({measuredEchoDistance}cm) - Baseline ({baselineClearance}cm) = <span className="text-emerald-700 font-bold">{singleDepth} cm</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Pothole Depth (cm)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="100"
                      value={singleDepth}
                      onChange={(e) => setSingleDepth(e.target.value)}
                      placeholder="e.g. 12.5"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={uploading}
                    className="w-full py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>{uploading ? 'Saving Pothole...' : 'Save Manual Pothole Reading'}</span>
                  </button>
                </form>
              )}

              {manualSubMode === 'batch' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Paste Data (CSV, Serial, or JSON)
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateSample}
                      className="flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-800 font-bold transition cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Generate Sample Data</span>
                    </button>
                  </div>

                  <textarea
                    value={batchRawInput}
                    onChange={(e) => {
                      setBatchRawInput(e.target.value);
                      try {
                        const parsed = parseBatchInput(e.target.value);
                        setParsedPreviewCount(parsed.length);
                      } catch {
                        setParsedPreviewCount(null);
                      }
                    }}
                    rows={6}
                    placeholder={`Paste CSV format:\n22.572645, 88.363892, 12.5\n\nOr JSON:\n[{"latitude": 22.5726, "longitude": 88.3639, "pothole_depth": 14.2}]`}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-mono text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white transition resize-none"
                  />

                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-dashed border-slate-300">
                    <span className="text-xs text-slate-600 font-medium">
                      Or select a file (.csv, .json, .txt):
                    </span>
                    <input
                      type="file"
                      accept=".csv,.json,.txt"
                      onChange={handleFileUpload}
                      className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                    />
                  </div>

                  {parsedPreviewCount !== null && (
                    <div className="text-xs text-emerald-900 bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg flex items-center justify-between font-semibold">
                      <span>Ready to ingest: {parsedPreviewCount} readings detected</span>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleBatchSubmit}
                      disabled={uploading || !batchRawInput.trim()}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition disabled:opacity-50 cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span>{uploading ? 'Ingesting...' : 'Submit Batch Data'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: WIFI */}
          {activeTab === 'wifi' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-xs text-emerald-800">
                    <Wifi className="w-4 h-4" />
                    <span>WiFi Telemetry Streaming</span>
                  </div>
                  <span className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white text-emerald-700 border border-emerald-200 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    REST Endpoint Online
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  The ESP32 connects to your WiFi and pushes geotagged pothole events (confirmed by MPU6500 &amp; HC-SR04) directly to the Django REST API via HTTP POST.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    ESP32 Destination URL
                  </span>
                  <button
                    onClick={handleCopyEndpoint}
                    className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                  >
                    {copiedEndpoint ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedEndpoint ? 'Copied!' : 'Copy URL'}</span>
                  </button>
                </div>
                <div className="bg-white px-3 py-2 rounded-lg font-mono text-xs text-slate-800 break-all border border-slate-200 shadow-2xs font-bold">
                  {apiEndpointUrl}
                </div>
                <p className="text-[11px] text-slate-500">
                  Update <code className="text-emerald-700 font-bold">API_ENDPOINT</code> in <code className="text-slate-700">esp32/pothole_esp32_collector.ino</code>.
                </p>
              </div>

              {/* Hardware Pinout */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] block">
                  Hardware Wiring Reference
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <strong className="text-emerald-700 block mb-0.5">HC-SR04 (Distance):</strong>
                    TRIG -&gt; GPIO 5<br />
                    ECHO -&gt; GPIO 18
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <strong className="text-amber-700 block mb-0.5">MPU6500 (Impact):</strong>
                    SDA -&gt; GPIO 21<br />
                    SCL -&gt; GPIO 22
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <strong className="text-teal-700 block mb-0.5">Neo-6M GPS:</strong>
                    TX -&gt; GPIO 16<br />
                    RX -&gt; GPIO 17
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <strong className="text-rose-700 block mb-0.5">Alerts:</strong>
                    LED -&gt; GPIO 2<br />
                    Buzzer -&gt; GPIO 4
                  </div>
                </div>
              </div>

              {/* In-Browser WiFi Simulator */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      Live Telemetry Stream Simulator
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Simulate live ESP32 vehicle telemetry with ultrasonic depth &amp; GPS
                    </span>
                  </div>
                  <button
                    onClick={handleToggleWifiSimulation}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      wifiSimulating
                        ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                    }`}
                  >
                    {wifiSimulating ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{wifiSimulating ? 'Stop Stream' : 'Start WiFi Stream'}</span>
                  </button>
                </div>

                <div className="bg-slate-900 rounded-xl p-3 font-mono text-[11px] h-32 overflow-y-auto space-y-1 text-slate-300 border border-slate-800">
                  {wifiLogs.length === 0 ? (
                    <span className="text-slate-500 italic">
                      Click "Start WiFi Stream" above or run `python simulate_esp32.py`...
                    </span>
                  ) : (
                    wifiLogs.map((log, idx) => (
                      <div key={idx} className={log.includes('201') ? 'text-emerald-400 font-bold' : log.includes('FAILED') ? 'text-rose-400' : 'text-slate-300'}>
                        {log}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: USB CABLE */}
          {activeTab === 'usb' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 text-teal-900 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-xs text-teal-800">
                    <Usb className="w-4 h-4" />
                    <span>USB Cable Web Serial Ingestion</span>
                  </div>
                  <span className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                    serialConnected
                      ? 'bg-white text-teal-800 border-teal-300 shadow-2xs'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${serialConnected ? 'bg-teal-500 animate-pulse' : 'bg-slate-400'}`} />
                    {serialConnected ? 'USB Active' : 'Not Connected'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Plug your ESP32 into this computer via USB cable. The browser reads the serial stream directly, plots detected potholes onto the map, and saves them to the database.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600">Baud:</span>
                    <select
                      value={selectedBaud}
                      disabled={serialConnected}
                      onChange={(e) => setSelectedBaud(Number(e.target.value))}
                      className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-800 font-bold focus:outline-none"
                    >
                      <option value={115200}>115200 (Default ESP32)</option>
                      <option value={9600}>9600</option>
                      <option value={57600}>57600</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    {!serialConnected ? (
                      <button
                        onClick={handleConnectUsb}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition cursor-pointer"
                      >
                        <Usb className="w-4 h-4" />
                        <span>Connect USB Cable</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleDisconnectUsb}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                        <span>Disconnect USB</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleSimulateUsbPacket}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition cursor-pointer shadow-2xs"
                    >
                      <span>Simulate USB Hit</span>
                    </button>
                  </div>
                </div>

                {serialConnected && (
                  <div className="text-xs text-teal-900 bg-white border border-teal-200 p-2.5 rounded-xl flex items-center justify-between font-semibold shadow-2xs">
                    <span>Connected: <strong>{serialPortInfo}</strong></span>
                    <span>Ingested: <strong>{usbIngestedCount} potholes</strong></span>
                  </div>
                )}
              </div>

              {/* USB Terminal */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <Terminal className="w-3.5 h-3.5 text-teal-600" />
                    <span>Live USB Serial Monitor</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoScrollSerial}
                        onChange={(e) => setAutoScrollSerial(e.target.checked)}
                        className="rounded text-teal-600"
                      />
                      <span>Auto-scroll</span>
                    </label>
                    <button
                      onClick={() => setSerialLogs([])}
                      className="text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="bg-slate-900 rounded-xl p-3 font-mono text-[11px] h-36 overflow-y-auto space-y-1 text-slate-300 border border-slate-800">
                  {serialLogs.length === 0 ? (
                    <span className="text-slate-500 italic">
                      No serial logs yet. Click "Connect USB Cable" or "Simulate USB Hit"...
                    </span>
                  ) : (
                    serialLogs.map((log, idx) => (
                      <div
                        key={idx}
                        className={
                          log.includes('INGESTED') ? 'text-emerald-400 font-bold' :
                          log.includes('CONNECTED') ? 'text-teal-400 font-bold' :
                          log.includes('ERROR') ? 'text-rose-400' :
                          'text-slate-300'
                        }
                      >
                        {log}
                      </div>
                    ))
                  )}
                  <div ref={serialTerminalEndRef} />
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                    Python CLI Bridge: usb_serial_bridge.py
                  </span>
                  <button
                    onClick={() => navigator.clipboard.writeText('python usb_serial_bridge.py')}
                    className="text-emerald-700 hover:text-emerald-800 flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Command</span>
                  </button>
                </div>
                <code className="block bg-white p-2 rounded-lg font-mono text-[11px] text-slate-800 border border-slate-200">
                  python usb_serial_bridge.py
                </code>
              </div>
            </div>
          )}

          {/* Status Alert */}
          {statusMessage && (
            <div className={`p-3 rounded-xl text-xs flex items-center gap-2 font-medium ${
              statusMessage.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' :
              statusMessage.type === 'error' ? 'bg-rose-50 border border-rose-200 text-rose-800' :
              'bg-teal-50 border border-teal-200 text-teal-800'
            }`}>
              {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{statusMessage.text}</span>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
