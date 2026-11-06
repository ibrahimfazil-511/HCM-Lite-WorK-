const EARTH_RADIUS_METERS = 6371000;

export function haversineDistanceMeters(latitudeA, longitudeA, latitudeB, longitudeB) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const deltaLatitude = toRadians(latitudeB - latitudeA);
  const deltaLongitude = toRadians(longitudeB - longitudeA);
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(toRadians(latitudeA)) * Math.cos(toRadians(latitudeB)) * Math.sin(deltaLongitude / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a));
}

export function parseCoordinates(payload) {
  const latitude = Number(payload?.latitude);
  const longitude = Number(payload?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

export function getOfficeDistance(coordinates, office) {
  if (!office || !Number.isFinite(Number(office.latitude)) || !Number.isFinite(Number(office.longitude))) return null;
  return haversineDistanceMeters(coordinates.latitude, coordinates.longitude, Number(office.latitude), Number(office.longitude));
}

export function getTodayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function getLateThreshold(office) {
  const [hours, minutes] = String(office?.startTime || "09:00").split(":").map(Number);
  const startMinutes = (Number.isFinite(hours) ? hours : 9) * 60 + (Number.isFinite(minutes) ? minutes : 0);
  return startMinutes + (Number.isFinite(Number(office?.graceMinutes)) ? Number(office.graceMinutes) : 0);
}

function getLocalMinutes(date) {
  const d = typeof date === "string" ? new Date(date) : date;
  if (!d || Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

export function isLate(date, office) {
  return (getLocalMinutes(date) || 0) > getLateThreshold(office);
}

export function getLateMinutes(date, office) {
  const [hours, minutes] = String(office?.startTime || "09:00").split(":").map(Number);
  const startMinutes = (Number.isFinite(hours) ? hours : 9) * 60 + (Number.isFinite(minutes) ? minutes : 0);
  const grace = Number.isFinite(Number(office?.graceMinutes)) ? Number(office.graceMinutes) : 0;
  const arrivalMinutes = getLocalMinutes(date);
  if (arrivalMinutes === null) return 0;
  const graceEndMinutes = startMinutes + grace;
  if (arrivalMinutes <= graceEndMinutes) return 0;
  return Math.max(0, arrivalMinutes - graceEndMinutes);
}

export function calculateLateHours(date, office) {
  const lateMinutes = getLateMinutes(date, office);
  return Number((lateMinutes / 60).toFixed(2));
}

export function getOfficeEndMinutes(office) {
  const [hours, minutes] = String(office?.endTime || "17:00").split(":").map(Number);
  return (Number.isFinite(hours) ? hours : 17) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}

export function getEarlyMinutes(date, office) {
  const checkoutMinutes = getLocalMinutes(date);
  if (checkoutMinutes === null) return 0;
  return Math.max(0, getOfficeEndMinutes(office) - checkoutMinutes);
}

export function getOvertimeMinutes(date, office) {
  const checkoutMinutes = getLocalMinutes(date);
  if (checkoutMinutes === null) return 0;
  return Math.max(0, checkoutMinutes - getOfficeEndMinutes(office));
}
