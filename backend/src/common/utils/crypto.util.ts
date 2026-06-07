import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

/** Genera un token opaco de alta entropía (URL-safe). */
export function generateOpaqueToken(bytes = 48): string {
  return randomBytes(bytes).toString('base64url');
}

/** Hash determinista (SHA-256) para indexar/comparar tokens sin guardarlos en claro. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Comparación en tiempo constante de dos hashes hex. */
export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Genera un código de emparejamiento legible: 8 caracteres en bloques (XXXX-XXXX),
 * con un alfabeto sin caracteres ambiguos (sin 0/O, 1/I/L).
 */
export function generatePairingCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** Normaliza un código introducido por el usuario (mayúsculas, sin espacios/guiones). */
export function normalizePairingCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
