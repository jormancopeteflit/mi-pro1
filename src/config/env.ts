/**
 * env.ts
 * Lee variables de entorno del build (definidas por EAS / metro config).
 * NUNCA contiene valores secretos hardcodeados.
 */
export const API_BASE_URL: string =
  (process.env.EXPO_PUBLIC_API_BASE_URL as string) ??
  'https://api.example.com'; // fallback solo para desarrollo local sin .env
