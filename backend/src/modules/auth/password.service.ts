import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/** Envoltorio de scrypt con opciones (promisify no admite el parámetro de opciones). */
function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

/**
 * Hashing de contraseñas con scrypt (incluido en Node, sin dependencias nativas).
 * Formato almacenado: scrypt$N$r$p$saltBase64$hashBase64
 *
 * Producción: scrypt es robusto y suficiente; si prefieres Argon2id, sustituye esta
 * implementación por `@node-rs/argon2` (prebuilds napi) manteniendo la misma interfaz.
 */
@Injectable()
export class PasswordService {
  private readonly N = 16_384; // coste CPU/memoria
  private readonly r = 8;
  private readonly p = 1;
  private readonly keyLen = 64;

  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const derived = (await scryptAsync(password, salt, this.keyLen, {
      N: this.N,
      r: this.r,
      p: this.p,
    })) as Buffer;
    return [
      'scrypt',
      this.N,
      this.r,
      this.p,
      salt.toString('base64'),
      derived.toString('base64'),
    ].join('$');
  }

  async verify(stored: string, password: string): Promise<boolean> {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const [, n, r, p, saltB64, hashB64] = parts;
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');
    const derived = (await scryptAsync(password, salt, expected.length, {
      N: parseInt(n, 10),
      r: parseInt(r, 10),
      p: parseInt(p, 10),
    })) as Buffer;
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  }
}
