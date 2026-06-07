import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashea y verifica correctamente la misma contraseña', async () => {
    const hash = await service.hash('una-contraseña-fuerte');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(await service.verify(hash, 'una-contraseña-fuerte')).toBe(true);
  });

  it('rechaza una contraseña incorrecta', async () => {
    const hash = await service.hash('correcta');
    expect(await service.verify(hash, 'incorrecta')).toBe(false);
  });

  it('produce hashes distintos por la sal aleatoria', async () => {
    const a = await service.hash('misma');
    const b = await service.hash('misma');
    expect(a).not.toBe(b);
  });

  it('no revienta con un hash mal formado', async () => {
    expect(await service.verify('formato-invalido', 'x')).toBe(false);
  });
});
