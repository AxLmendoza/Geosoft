/**
 * Mapa sin agrupación: cada reporte tiene su propio pin. Cuando varios caen en el mismo punto,
 * o tan cerca que en pantalla se taparían, se abren en abanico alrededor de su centro para que
 * cada uno se pueda tocar. Solo calcula desplazamientos en px: las coordenadas reales no cambian.
 *
 * Función pura (sin mapa ni DOM) para poder probarla de forma aislada.
 */
export type ScreenPoint = { id: number; x: number; y: number }
export type Offset = [number, number]
export type SpreadResult = {
  /** Desplazamiento en px de cada pin abierto en abanico (los demás no aparecen) */
  offsets: Map<number, Offset>
  /** Centro en pantalla de cada abanico (dónde están realmente esos reportes) */
  centers: { key: string; x: number; y: number }[]
}

/** Pines a menos de esta distancia en pantalla (px) se taparían entre sí */
export const OVERLAP_PX = 24
/** Separación entre pines del abanico (px): un pin mide 44 px de ancho */
export const SPREAD_GAP_PX = 42
/** Hasta este número se usa un anillo; con más, una espiral */
const RING_MAX = 8
/** Ángulo áureo (rad): reparte los pines de la espiral sin que se encimen */
const GOLDEN_ANGLE = 2.39996

export function spreadPins(points: ScreenPoint[], overlap = OVERLAP_PX, gap = SPREAD_GAP_PX): SpreadResult {
  // Unión de los que se taparían (union-find sobre una rejilla del tamaño del umbral)
  const parent = points.map((_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  const grid = new Map<string, number[]>()
  points.forEach((p, i) => {
    const gx = Math.floor(p.x / overlap)
    const gy = Math.floor(p.y / overlap)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const j of grid.get(`${gx + dx}:${gy + dy}`) ?? []) {
          if (Math.hypot(points[j].x - p.x, points[j].y - p.y) < overlap) parent[find(i)] = find(j)
        }
      }
    }
    const cell = `${gx}:${gy}`
    const list = grid.get(cell)
    if (list) list.push(i)
    else grid.set(cell, [i])
  })

  const byRoot = new Map<number, number[]>()
  points.forEach((_, i) => {
    const root = find(i)
    const list = byRoot.get(root)
    if (list) list.push(i)
    else byRoot.set(root, [i])
  })
  let groups = [...byRoot.values()]

  // Radio del anillo / espiral que ocupa un abanico de n pines (0 si es un pin solo)
  const ringRadius = (n: number) => Math.max(gap / 2, gap / (2 * Math.sin(Math.PI / n)))
  const spiralRadius = (k: number) => (gap / 1.5) * Math.sqrt(k + 0.5)
  const footprint = (n: number) => (n < 2 ? 0 : n <= RING_MAX ? ringRadius(n) : spiralRadius(n - 1))
  const centerOf = (g: number[]) => ({
    x: g.reduce((s, i) => s + points[i].x, 0) / g.length,
    y: g.reduce((s, i) => s + points[i].y, 0) / g.length,
  })

  // Un abanico abierto ocupa más espacio: si alcanza a otro pin u otro abanico, se fusionan
  // en uno solo y se vuelve a calcular, hasta que ningún pin quede encima de otro.
  for (let pass = 0; pass < 25; pass++) {
    const info = groups.map((g) => ({ ...centerOf(g), r: footprint(g.length) }))
    const gp = groups.map((_, i) => i)
    const gfind = (i: number): number => (gp[i] === i ? i : (gp[i] = gfind(gp[i])))
    let merged = false
    for (let i = 0; i < info.length; i++) {
      for (let j = i + 1; j < info.length; j++) {
        const a = info[i]
        const b = info[j]
        if (a.r === 0 && b.r === 0) continue // dos pines solos ya se separaron arriba
        if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r + overlap && gfind(i) !== gfind(j)) {
          gp[gfind(j)] = gfind(i)
          merged = true
        }
      }
    }
    if (!merged) break
    const next = new Map<number, number[]>()
    groups.forEach((g, i) => {
      const root = gfind(i)
      next.set(root, [...(next.get(root) ?? []), ...g])
    })
    groups = [...next.values()]
  }

  const result: SpreadResult = { offsets: new Map(), centers: [] }
  for (const members of groups) {
    if (members.length < 2) continue
    // Orden estable (por folio) para que cada pin conserve su lugar entre recálculos
    members.sort((a, b) => points[a].id - points[b].id)
    const n = members.length
    const { x: cx, y: cy } = centerOf(members)
    members.forEach((i, k) => {
      const ring = n <= RING_MAX
      // Anillo: `gap` px entre vecinos, empezando arriba. Espiral: radio que crece con √k
      const radius = ring ? ringRadius(n) : spiralRadius(k)
      const angle = ring ? -Math.PI / 2 + (2 * Math.PI * k) / n : k * GOLDEN_ANGLE
      const x = cx + radius * Math.cos(angle)
      const y = cy + radius * Math.sin(angle)
      result.offsets.set(points[i].id, [Math.round(x - points[i].x), Math.round(y - points[i].y)])
    })
    result.centers.push({ key: String(points[members[0]].id), x: cx, y: cy })
  }
  return result
}
