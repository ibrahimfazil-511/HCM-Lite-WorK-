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
  return startMinutes + (Number.isFinite(Number(office?.graceMinutes)) ? Number(office.graceMinutes) : 15);
}

export function isLate(date, office) {
  return date.getHours() * 60 + date.getMinutes() > getLateThreshold(office);
}
