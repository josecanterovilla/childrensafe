import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { MailService } from '../src/modules/mail/mail.service';

/**
 * Prueba E2E del alta de cuenta por correo: registro → confirmación por código → login,
 * login bloqueado sin verificar, y recuperación de contraseña por código.
 *
 * El MailService se reemplaza por un mock que captura los códigos "enviados", así no se
 * manda ningún correo real y el test puede leer el código.
 */
describe('ChildrenSafe Auth por correo (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: ReturnType<INestApplication['getHttpServer']>;

  const sent: { to: string; code: string; purpose: string }[] = [];
  const mailMock = {
    sendCode: jest.fn(async (to: string, code: string, purpose: string) => {
      sent.push({ to, code, purpose });
    }),
  };

  const ts = Date.now();
  const email = `e2e_mail_${ts}@childrensafe.test`;
  const password = 'una-contrasena-fuerte-123';
  const newPassword = 'otra-contrasena-distinta-456';

  const lastCode = (purpose: string): string => {
    const found = [...sent].reverse().find((c) => c.to === email && c.purpose === purpose);
    if (!found) throw new Error(`No se capturó código ${purpose} para ${email}`);
    return found.code;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue(mailMock)
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
    const users = await prisma.user.findMany({
      where: { email },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    const members = await prisma.familyMember.findMany({
      where: { userId: { in: userIds } },
      select: { familyId: true },
    });
    const familyIds = [...new Set(members.map((m) => m.familyId))];
    await prisma.auditLog.deleteMany({
      where: { OR: [{ actorUserId: { in: userIds } }, { familyId: { in: familyIds } }] },
    });
    await prisma.family.deleteMany({ where: { id: { in: familyIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('registra sin emitir tokens y envía un código de confirmación', async () => {
    const res = await request(server)
      .post('/api/auth/register')
      .send({ email, password, displayName: 'Tutor E2E', familyName: 'Familia Mail E2E' })
      .expect(201);
    expect(res.body.needsVerification).toBe(true);
    expect(res.body.accessToken).toBeUndefined();
    expect(lastCode('VERIFY_EMAIL')).toMatch(/^\d{6}$/);
  });

  it('bloquea el login mientras el correo no esté confirmado (EMAIL_NOT_VERIFIED)', async () => {
    const res = await request(server)
      .post('/api/auth/login')
      .send({ email, password })
      .expect(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('rechaza un código de confirmación incorrecto', async () => {
    await request(server)
      .post('/api/auth/verify-email')
      .send({ email, code: '000000' })
      .expect(400);
  });

  it('confirma el correo con el código correcto y emite tokens', async () => {
    const res = await request(server)
      .post('/api/auth/verify-email')
      .send({ email, code: lastCode('VERIFY_EMAIL') })
      .expect(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });

  it('permite el login una vez confirmado', async () => {
    const res = await request(server)
      .post('/api/auth/login')
      .send({ email, password })
      .expect(201);
    expect(res.body.accessToken).toBeDefined();
  });

  it('recupera la contraseña por código y permite entrar con la nueva', async () => {
    await request(server).post('/api/auth/forgot-password').send({ email }).expect(200);
    const code = lastCode('PASSWORD_RESET');
    expect(code).toMatch(/^\d{6}$/);

    await request(server)
      .post('/api/auth/reset-password')
      .send({ email, code, newPassword })
      .expect(200);

    // La contraseña vieja ya no sirve…
    await request(server).post('/api/auth/login').send({ email, password }).expect(401);
    // …y la nueva sí.
    await request(server)
      .post('/api/auth/login')
      .send({ email, password: newPassword })
      .expect(201);
  });
});
