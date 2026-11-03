import { API_URL } from './axios'

/** Las imágenes se guardan en el servidor como /uploads/... */
export const assetUrl = (path: string) => (path.startsWith('http') ? path : `${API_URL}${path}`)
