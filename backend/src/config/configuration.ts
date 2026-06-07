/**
 * Configuración tipada de la aplicación. Se carga una sola vez y se valida al arrancar
 * (ver env.validation.ts). Nunca pongas secretos en el código: vienen de variables de entorno.
 */
export interface AppConfig {
  env: string;
  port: number;
  corsOrigins: string[];
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: number;
    refreshTtl: number;
  };
  pairing: {
    codeTtl: number;
    maxAttempts: number;
  };
  retention: {
    locationHours: number;
  };
  google: {
    /** Web OAuth Client ID; audiencia esperada del ID token de Google. */
    clientId: string;
  };
}

export default (): AppConfig => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:8080')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET as string,
    refreshSecret: process.env.JWT_REFRESH_SECRET as string,
    accessTtl: parseInt(process.env.JWT_ACCESS_TTL ?? '900', 10),
    refreshTtl: parseInt(process.env.JWT_REFRESH_TTL ?? '2592000', 10),
  },
  pairing: {
    codeTtl: parseInt(process.env.PAIRING_CODE_TTL ?? '900', 10),
    maxAttempts: parseInt(process.env.PAIRING_MAX_ATTEMPTS ?? '5', 10),
  },
  retention: {
    locationHours: parseInt(process.env.LOCATION_RETENTION_HOURS ?? '72', 10),
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
  },
});
