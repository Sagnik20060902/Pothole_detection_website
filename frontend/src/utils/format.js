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
      colorClass: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
      badgeBg: 'bg-rose-500',
      strokeColor: '#f43f5e',
    };
  } else if (d >= 7.0) {
    return {
      label: 'Moderate Pothole',
      colorClass: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      badgeBg: 'bg-amber-500',
      strokeColor: '#f59e0b',
    };
  } else {
    return {
      label: 'Minor Surface Defect',
      colorClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      badgeBg: 'bg-emerald-500',
      strokeColor: '#10b981',
    };
  }
};
