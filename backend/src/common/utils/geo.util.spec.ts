import { haversineMeters, isInside } from './geo.util';

describe('geo.util', () => {
  it('calcula ~0 metros para el mismo punto', () => {
    expect(haversineMeters(-25.2637, -57.5759, -25.2637, -57.5759)).toBeCloseTo(0, 5);
  });

  it('calcula una distancia conocida (~111 km por 1° de latitud)', () => {
    const d = haversineMeters(0, 0, 1, 0);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it('detecta un punto dentro del radio', () => {
    // ~100 m al norte del centro
    expect(isInside(-25.2628, -57.5759, -25.2637, -57.5759, 150)).toBe(true);
  });

  it('detecta un punto fuera del radio', () => {
    expect(isInside(-25.2500, -57.5759, -25.2637, -57.5759, 150)).toBe(false);
  });
});
