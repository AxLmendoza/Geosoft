/**
 * Geocodificación inversa con Nominatim (OpenStreetMap) para sugerir colonia y calle.
 * Uso ligero: una petición cuando el usuario fija el punto. Para producción con
 * mucho tráfico conviene un proveedor propio (respeta su política de uso).
 */
export async function reverseGeocode(lat: number, lng: number) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=es&zoom=18`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const data = await res.json()
    const a = data.address ?? {}
    return {
      colonia: a.neighbourhood ?? a.suburb ?? a.quarter ?? a.city_district ?? '',
      calle: [a.road, a.house_number].filter(Boolean).join(' '),
    }
  } catch {
    return null
  }
}
