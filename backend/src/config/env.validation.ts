/**
 * Validación de variables de entorno al arranque. Si falta algo crítico (p. ej. secretos JWT
 * o la URL de la base de datos), la app NO arranca: mejor fallar rápido que correr insegura.
 */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const required = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
  const missing = required.filter((key) => !config[key] || `${config[key]}`.trim() === '');

  if (missing.length > 0) {
    throw new Error(
      `Faltan variables de entorno requeridas: ${missing.join(', ')}. ` +
        `Copia .env.example a .env y complétalas.`,
    );
  }

  const insecureDefaults = ['CHANGE_ME_access_secret', 'CHANGE_ME_refresh_secret'];
  const usingDefault = [config.JWT_ACCESS_SECRET, config.JWT_REFRESH_SECRET].some((v) =>
    insecureDefaults.includes(`${v}`),
  );
  if (usingDefault && config.NODE_ENV === 'production') {
    throw new Error('No puedes usar los secretos JWT por defecto en producción. Genera secretos fuertes.');
  }

  return config;
}
