import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { authenticator } from 'otplib';
import { EmailCodePurpose } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { sha256 } from '../src/common/utils/crypto.util';

/**
 * E2E de cuenta y seguridad: recuperación de contraseña, cambio de contraseña, MFA (TOTP),
 * exportación de datos (GDPR) y eliminación de cuenta. Limpia lo que crea.
 */
describe('ChildrenSafe E2E (cuenta y seguridad)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: ReturnType<INestApplication['getHttpServer']>;

  const email = `acc_${Date.now()}@childrensafe.test`;
  const P0 = 'contrasena-inicial-123';
  let currentPassword = P0;
  let token: string;
  let userId: string;
  let familyId: string;

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
    prisma = app.get(PrismaService);
    server = app.getHttpServer();

    await request(server)
      .post('/api/auth/register')
      .send({ email, password: P0, displayName: 'Ana Tutora', familyName: 'Familia Cuenta' })
      .expect(201);
    // Este test no cubre el flujo de correo (ver auth-email.e2e); confirmamos directo en la BD.
    const u = await prisma.user.update({ where: { email }, data: { emailVerified: true } });
    userId = u.id;
    const login = await request(server)
      .post('/api/auth/login')
      .send({ email, password: P0 })
      .expect(201);
    token = login.body.accessToken;

    const fams = await request(server)
      .get('/api/families')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    familyId = fams.body[0].familyId;
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

  it('forgot-password responde 200 y crea un código de reseteo', async () => {
    await request(server).post('/api/auth/forgot-password').send({ email }).expect(200);
    const count = await prisma.emailCode.count({
      where: { userId, purpose: EmailCodePurpose.PASSWORD_RESET },
    });
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it('forgot-password con email inexistente también responde 200 (anti-enumeración)', async () => {
    await request(server)
      .post('/api/auth/forgot-password')
      .send({ email: 'noexiste@childrensafe.test' })
      .expect(200);
  });

  it('reset-password cambia la contraseña con un código válido', async () => {
    const code = '654321';
    await prisma.emailCode.create({
      data: {
        userId,
        purpose: EmailCodePurpose.PASSWORD_RESET,
        codeHash: sha256(code),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    const P1 = 'contrasena-reseteada-123';
    await request(server)
      .post('/api/auth/reset-password')
      .send({ email, code, newPassword: P1 })
      .expect(200);

    await request(server).post('/api/auth/login').send({ email, password: P1 }).expect(201);
    await request(server).post('/api/auth/login').send({ email, password: P0 }).expect(401);
    currentPassword = P1;
  });

  it('reset-password con código inválido falla (400)', async () => {
    await request(server)
      .post('/api/auth/reset-password')
      .send({ email, code: '111111', newPassword: 'cualquiera-larga-123' })
      .expect(400);
  });

  it('change-password cambia la contraseña reautenticando', async () => {
    const login = await request(server)
      .post('/api/auth/login')
      .send({ email, password: currentPassword })
      .expect(201);
    const t = login.body.accessToken;

    const P2 = 'contrasena-cambiada-123';
    await request(server)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${t}`)
      .send({ currentPassword, newPassword: P2 })
      .expect(200);

    await request(server).post('/api/auth/login').send({ email, password: currentPassword }).expect(401);
    const relog = await request(server).post('/api/auth/login').send({ email, password: P2 }).expect(201);
    token = relog.body.accessToken;
    currentPassword = P2;
  });

  it('flujo MFA: setup → enable → login exige código → disable', async () => {
    const setup = await request(server)
      .post('/api/auth/mfa/setup')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const secret = setup.body.secret as string;
    expect(setup.body.otpauthUrl).toContain('otpauth://');

    await request(server)
      .post('/api/auth/mfa/enable')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: authenticator.generate(secret) })
      .expect(200);

    // Ahora el login SIN código debe fallar...
    await request(server).post('/api/auth/login').send({ email, password: currentPassword }).expect(401);
    // ...y CON código válido debe funcionar.
    await request(server)
      .post('/api/auth/login')
      .send({ email, password: currentPassword, mfaCode: authenticator.generate(secret) })
      .expect(201);

    // Desactivar MFA (reautenticando con contraseña + código).
    await request(server)
      .post('/api/auth/mfa/disable')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: currentPassword, code: authenticator.generate(secret) })
      .expect(200);

    await request(server).post('/api/auth/login').send({ email, password: currentPassword }).expect(201);
  });

  it('export devuelve los datos del usuario y su familia (GDPR)', async () => {
    const res = await request(server)
      .get('/api/account/export')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.user.email).toBe(email);
    expect(Array.isArray(res.body.families)).toBe(true);
    const fam = res.body.families.find((f: { familyId: string }) => f.familyId === familyId);
    expect(fam).toBeDefined();
    expect(fam.role).toBe('PARENT');
  });

  it('delete con contraseña incorrecta falla (401)', async () => {
    await request(server)
      .post('/api/account/delete')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'incorrecta' })
      .expect(401);
  });

  it('delete elimina la cuenta y su familia (sole parent)', async () => {
    await request(server)
      .post('/api/account/delete')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: currentPassword })
      .expect(200);

    const users = await prisma.user.count({ where: { id: userId } });
    const fams = await prisma.family.count({ where: { id: familyId } });
    expect(users).toBe(0);
    expect(fams).toBe(0);

    // El access token ya no sirve (el usuario no existe / no está ACTIVE).
    await request(server).get('/api/families').set('Authorization', `Bearer ${token}`).expect(401);
  });
});
