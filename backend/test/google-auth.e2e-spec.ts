import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GoogleVerifier } from '../src/modules/auth/google-verifier.service';

/**
 * E2E de "Entrar con Google". El verificador de Google se mockea (no podemos generar un ID token
 * real en pruebas), de modo que se ejerce la lógica real de crear/enlazar cuenta contra Supabase.
 */
describe('ChildrenSafe E2E (Google Sign-In)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: ReturnType<INestApplication['getHttpServer']>;

  const email = `google_${Date.now()}@gmail.com`;
  const sub = `g-sub-${Date.now()}`;
  let userId: string;

  const mockVerifier = {
    verify: async (idToken: string) => {
      if (idToken === 'UNVERIFIED') {
        return { sub: `${sub}-unv`, email: `unv_${Date.now()}@gmail.com`, emailVerified: false };
      }
      return { sub, email, emailVerified: true, name: 'Tutor Google' };
    },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(GoogleVerifier)
      .useValue(mockVerifier)
      .compile();
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
    prisma = app.get(PrismaService);
    server = app.getHttpServer();
  });

  afterAll(async () => {
    const u = await prisma.user.findUnique({ where: { email }, include: { memberships: true } });
    if (u) {
      const famIds = u.memberships.map((m) => m.familyId);
      await prisma.auditLog.deleteMany({
        where: { OR: [{ actorUserId: u.id }, { familyId: { in: famIds } }] },
      });
      await prisma.family.deleteMany({ where: { id: { in: famIds } } });
      await prisma.user.delete({ where: { id: u.id } }).catch(() => undefined);
    }
    await app.close();
  });

  it('crea la cuenta del tutor (y su familia) en el primer inicio con Google', async () => {
    const res = await request(server).post('/api/auth/google').send({ idToken: 'VALID' }).expect(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.isNew).toBe(true);
    userId = res.body.userId;

    const u = await prisma.user.findUnique({ where: { id: userId } });
    expect(u?.googleId).toBe(sub);
    const member = await prisma.familyMember.findFirst({ where: { userId, role: 'PARENT' } });
    expect(member).toBeTruthy();
  });

  it('en el segundo inicio reutiliza la misma cuenta (no duplica)', async () => {
    const res = await request(server).post('/api/auth/google').send({ idToken: 'VALID' }).expect(201);
    expect(res.body.userId).toBe(userId);
    expect(res.body.isNew).toBe(false);
    const count = await prisma.user.count({ where: { googleId: sub } });
    expect(count).toBe(1);
  });

  it('rechaza si el email de Google no está verificado (401)', async () => {
    await request(server).post('/api/auth/google').send({ idToken: 'UNVERIFIED' }).expect(401);
  });

  it('rechaza cuerpo inválido sin idToken (400)', async () => {
    await request(server).post('/api/auth/google').send({}).expect(400);
  });
});
