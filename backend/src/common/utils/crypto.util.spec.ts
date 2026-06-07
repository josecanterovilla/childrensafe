import {
  generatePairingCode,
  normalizePairingCode,
  sha256,
  safeEqualHex,
} from './crypto.util';

describe('crypto.util', () => {
  it('genera códigos de emparejamiento con formato XXXX-XXXX', () => {
    const code = generatePairingCode();
    expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });

  it('genera códigos distintos (alta entropía)', () => {
    const codes = new Set(Array.from({ length: 200 }, () => generatePairingCode()));
    expect(codes.size).toBeGreaterThan(195);
  });

  it('normaliza el código quitando guiones y espacios y subiendo a mayúsculas', () => {
    expect(normalizePairingCode('jx4k-82mz')).toBe('JX4K82MZ');
    expect(normalizePairingCode(' Jx 4k 82mz ')).toBe('JX4K82MZ');
  });

  it('sha256 es determinista y safeEqualHex compara correctamente', () => {
    const a = sha256('hola');
    const b = sha256('hola');
    expect(a).toBe(b);
    expect(safeEqualHex(a, b)).toBe(true);
    expect(safeEqualHex(a, sha256('otro'))).toBe(false);
  });
});
