import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Prueba E2E del flujo completo de Fase 1 por HTTP (registro → familia → emparejamiento →
 * ubicación → SOS → RBAC → alertas). Se ejecuta contra la base configurada en DATABASE_URL
 * y limpia todos los datos que crea al terminar.
 *
 * Ejecutar:  npm run test:e2e
 */
describe('ChildrenSafe E2E (Fase 1)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: ReturnType<INestApplication['getHttpServer']>;

  const email = `e2e_${Date.now()}@childrensafe.test`;
  const password = 'una-contrasena-fuerte-123';

  let parentToken: string;
  let childToken: string;
  let familyId: string;
  let childProfileId: string;
  let pairingCode: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    // Reproduce la configuración de bootstrap (main.ts).
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    server = app.getHttpServer();
  });

  afterAll(async () => {
    // Limpieza: borra auditoría, familia (cascada) y usuarios creados por la prueba.
    if (familyId) {
      const members = await prisma.familyMember.findMany({
        where: { familyId },
        select: { userId: true },
      });
      const userIds = members.map((m) => m.userId);
      await prisma.auditLog.deleteMany({
        where: { OR: [{ familyId }, { actorUserId: { in: userIds } }] },
      });
      await prisma.family.delete({ where: { id: familyId } }).catch(() => undefined);
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await app.close();
  });

  it('registra un tutor y emite tokens', async () => {
    const res = await request(server)
      .post('/api/auth/register')
      .send({ email, password, displayName: 'Ana Tutora', familyName: 'Familia E2E' })
      .expect(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.userId).toBeDefined();
  });

  it('rechaza credenciales inválidas', async () => {
    await request(server)
      .post('/api/auth/login')
      .send({ email, password: 'incorrecta' })
      .expect(401);
  });

  it('inicia sesión correctamente', async () => {
    const res = await request(server)
      .post('/api/auth/login')
      .send({ email, password })
      .expect(201);
    parentToken = res.body.accessToken;
    expect(parentToken).toBeDefined();
  });

  it('rechaza acceso sin token', async () => {
    await request(server).get('/api/families').expect(401);
  });

  it('lista las familias del tutor (rol PARENT)', async () => {
    const res = await request(server)
      .get('/api/families')
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    familyId = res.body[0].familyId;
    expect(res.body[0].role).toBe('PARENT');
  });

  it('valida el cuerpo (DTO) al generar un código', async () => {
    await request(server)
      .post(`/api/families/${familyId}/pairing-codes`)
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ childDisplayName: 'Lucía', childAgeBand: 'EDAD_INVALIDA' })
      .expect(400);
  });

  it('genera un código de emparejamiento (solo PARENT)', async () => {
    const res = await request(server)
      .post(`/api/families/${familyId}/pairing-codes`)
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ childDisplayName: 'Lucía', childAgeBand: 'PRETEEN' })
      .expect(201);
    pairingCode = res.body.code;
    expect(pairingCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(res.body.qrPayload).toContain('childrensafe://pair?code=');
  });

  it('el menor canjea el código y recibe tokens', async () => {
    const res = await request(server)
      .post('/api/pairing/join')
      .send({
        code: pairingCode,
        displayName: 'Lucía',
        device: { platform: 'ANDROID', deviceName: 'Android de Lucía', deviceUuid: `e2e-${Date.now()}` },
      })
      .expect(201);
    childToken = res.body.accessToken;
    childProfileId = res.body.childProfileId;
    expect(childToken).toBeDefined();
    expect(res.body.familyId).toBe(familyId);
  });

  it('un código ya canjeado no se puede reutilizar', async () => {
    await request(server)
      .post('/api/pairing/join')
      .send({
        code: pairingCode,
        device: { platform: 'ANDROID', deviceName: 'Otro', deviceUuid: `e2e-x-${Date.now()}` },
      })
      .expect(400);
  });

  it('el menor reporta ubicación (idempotente)', async () => {
    const clientEventId = `evt-${Date.now()}`;
    const body = { latitude: -25.2637, longitude: -57.5759, batteryLevel: 70, clientEventId };
    await request(server)
      .post(`/api/families/${familyId}/location`)
      .set('Authorization', `Bearer ${childToken}`)
      .send(body)
      .expect(201);
    // Reenvío con el mismo clientEventId: no debe duplicar.
    await request(server)
      .post(`/api/families/${familyId}/location`)
      .set('Authorization', `Bearer ${childToken}`)
      .send(body)
      .expect(201);

    const hist = await request(server)
      .get(`/api/families/${familyId}/children/${childProfileId}/location/history`)
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(200);
    expect(hist.body.length).toBe(1);
  });

  it('RBAC: el menor NO puede generar códigos de emparejamiento', async () => {
    await request(server)
      .post(`/api/families/${familyId}/pairing-codes`)
      .set('Authorization', `Bearer ${childToken}`)
      .send({ childDisplayName: 'X', childAgeBand: 'TEEN' })
      .expect(403);
  });

  it('SOS del menor genera una alerta CRÍTICA visible para el tutor', async () => {
    await request(server)
      .post(`/api/families/${familyId}/sos`)
      .set('Authorization', `Bearer ${childToken}`)
      .send({ latitude: -25.3, longitude: -57.6, message: 'Necesito ayuda' })
      .expect(201);

    const alerts = await request(server)
      .get(`/api/families/${familyId}/alerts`)
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(200);
    const sos = alerts.body.find((a: { type: string }) => a.type === 'SOS');
    expect(sos).toBeDefined();
    expect(sos.severity).toBe('CRITICAL');
  });
});
