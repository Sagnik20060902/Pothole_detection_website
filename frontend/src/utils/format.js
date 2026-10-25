export const formatDate = (isoString) => {
  if (!isoString) return 'N/A';
  try {
    const d = new Date(isoString);
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return isoString;
  }
};

export const formatCoordinates = (lat, lng) => {
  if (lat === undefined || lng === undefined || lat === null || lng === null) return 'N/A';
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(6)}° ${latDir}, ${Math.abs(lng).toFixed(6)}° ${lngDir}`;
};

export const getDepthSeverity = (depth) => {
  const d = Number(depth) || 0;
  if (d >= 14.0) {
    return {
      label: 'Severe Pothole',
      colorClass: 'text-rose-700 bg-rose-50 border-rose-200',
      badgeBg: 'bg-rose-500',
      strokeColor: '#e11d48',
    };
  } else if (d >= 7.0) {
    return {
      label: 'Moderate Pothole',
      colorClass: 'text-amber-700 bg-amber-50 border-amber-200',
      badgeBg: 'bg-amber-500',
      strokeColor: '#d97706',
    };
  } else {
    return {
      label: 'Minor Surface Defect',
      colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      badgeBg: 'bg-emerald-500',
      strokeColor: '#059669',
    };
  }
};

export const getSourceInfo = (source) => {
  const s = (source || '').toLowerCase();
  switch (s) {
    case 'wifi':
      return {
        label: 'WiFi Live Stream',
        shortLabel: 'WiFi',
        badgeClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        dotColor: 'bg-emerald-500',
      };
    case 'usb_serial':
    case 'usb':
    case 'serial':
      return {
        label: 'USB Cable (Serial)',
        shortLabel: 'USB Serial',
        badgeClass: 'text-teal-700 bg-teal-50 border-teal-200',
        dotColor: 'bg-teal-500',
      };
    case 'manual':
    default:
      return {
        label: 'Manual Upload',
        shortLabel: 'Manual',
        badgeClass: 'text-slate-700 bg-slate-100 border-slate-200',
        dotColor: 'bg-slate-500',
      };
  }
};
