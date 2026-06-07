import { AddressInfo } from 'node:net';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * E2E de tiempo real: un tutor conectado por WebSocket recibe en vivo la ubicación y las
 * alertas (SOS) que genera el dispositivo del menor. Verifica también el rechazo sin token.
 */
describe('ChildrenSafe E2E (tiempo real)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let baseUrl: string;

  const email = `rt_${Date.now()}@childrensafe.test`;
  const password = 'contrasena-rt-123456';
  let parentToken: string;
  let childToken: string;
  let familyId: string;

  const waitForEvent = <T = unknown>(socket: Socket, event: string, timeoutMs = 15000) =>
    new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout esperando "${event}"`)), timeoutMs);
      socket.once(event, (data: T) => {
        clearTimeout(timer);
        resolve(data);
      });
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
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
    await app.listen(0); // puerto aleatorio; el WS necesita un servidor escuchando
    prisma = app.get(PrismaService);
    server = app.getHttpServer();
    const port = (server.address() as AddressInfo).port;
    baseUrl = `http://127.0.0.1:${port}`;

    // Tutor + familia
    const reg = await request(server)
      .post('/api/auth/register')
      .send({ email, password, displayName: 'Ana Tutora', familyName: 'Familia RT' })
      .expect(201);
    parentToken = reg.body.accessToken;
    const fams = await request(server)
      .get('/api/families')
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(200);
    familyId = fams.body[0].familyId;

    // Menor vinculado (para reportar ubicación y SOS)
    const code = await request(server)
      .post(`/api/families/${familyId}/pairing-codes`)
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ childDisplayName: 'Lucía', childAgeBand: 'PRETEEN' })
      .expect(201);
    const join = await request(server)
      .post('/api/pairing/join')
      .send({
        code: code.body.code,
        device: { platform: 'ANDROID', deviceName: 'Android de Lucía', deviceUuid: `rt-${Date.now()}` },
      })
      .expect(201);
    childToken = join.body.accessToken;
  });

  afterAll(async () => {
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
    await app.close();
  });

  it('rechaza la conexión sin token válido', async () => {
    const socket = io(`${baseUrl}/realtime`, {
      transports: ['websocket'],
      forceNew: true,
      auth: { token: 'token-invalido' },
    });
    try {
      await waitForEvent(socket, 'unauthorized', 8000);
    } finally {
      socket.disconnect();
    }
  });

  it('el tutor recibe en vivo la ubicación reportada por el menor', async () => {
    const socket = io(`${baseUrl}/realtime`, {
      transports: ['websocket'],
      forceNew: true,
      auth: { token: parentToken },
    });
    try {
      const ready = await waitForEvent<{ families: string[] }>(socket, 'ready');
      expect(ready.families).toContain(familyId);

      const locationPromise = waitForEvent<{ childProfileId: string; latitude: number }>(
        socket,
        'location',
      );
      await request(server)
        .post(`/api/families/${familyId}/location`)
        .set('Authorization', `Bearer ${childToken}`)
        .send({ latitude: -25.2637, longitude: -57.5759, batteryLevel: 80 })
        .expect(201);

      const loc = await locationPromise;
      expect(loc.latitude).toBeCloseTo(-25.2637, 3);
    } finally {
      socket.disconnect();
    }
  });

  it('el tutor recibe en vivo la alerta de SOS del menor', async () => {
    const socket = io(`${baseUrl}/realtime`, {
      transports: ['websocket'],
      forceNew: true,
      auth: { token: parentToken },
    });
    try {
      await waitForEvent(socket, 'ready');

      const alertPromise = waitForEvent<{ type: string; severity: string }>(socket, 'alert');
      await request(server)
        .post(`/api/families/${familyId}/sos`)
        .set('Authorization', `Bearer ${childToken}`)
        .send({ latitude: -25.3, longitude: -57.6, message: 'Necesito ayuda' })
        .expect(201);

      const alert = await alertPromise;
      expect(alert.type).toBe('SOS');
      expect(alert.severity).toBe('CRITICAL');
    } finally {
      socket.disconnect();
    }
  });
});
