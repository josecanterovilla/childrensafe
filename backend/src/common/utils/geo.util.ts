/** Distancia en metros entre dos coordenadas (fórmula de Haversine). */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6_371_000; // radio terrestre medio en metros
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** ¿El punto está dentro del radio de la geocerca? */
export function isInside(
  pointLat: number,
  pointLon: number,
  centerLat: number,
  centerLon: number,
  radiusM: number,
): boolean {
  return haversineMeters(pointLat, pointLon, centerLat, centerLon) <= radiusM;
}
