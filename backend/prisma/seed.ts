/**
 * Seed de desarrollo: crea un tutor demo con su familia y una geocerca "Casa".
 * Ejecuta:  npm run seed   (requiere DATABASE_URL accesible)
 *
 * NO usar en producción. Las credenciales demo son solo para pruebas locales.
 */
import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const N = 16_384;
  const r = 8;
  const p = 1;
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64, { N, r, p });
  return ['scrypt', N, r, p, salt.toString('base64'), derived.toString('base64')].join('$');
}

async function main(): Promise<void> {
  const email = 'demo@childrensafe.app';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log('El seed ya fue aplicado (usuario demo existe).');
    return;
  }

  const parent = await prisma.user.create({
    data: {
      email,
      displayName: 'Tutor Demo',
      passwordHash: hashPassword('contraseña-demo-123'),
    },
  });

  const family = await prisma.family.create({ data: { name: 'Familia Demo' } });
  await prisma.familyMember.create({
    data: { familyId: family.id, userId: parent.id, role: 'PARENT' },
  });

  await prisma.geofence.create({
    data: {
      familyId: family.id,
      createdByUserId: parent.id,
      name: 'Casa',
      type: 'HOME',
      latitude: -25.2637,
      longitude: -57.5759,
      radiusM: 150,
    },
  });

  console.log('Seed aplicado:');
  console.log('  Email:    ', email);
  console.log('  Password: ', 'contraseña-demo-123');
  console.log('  Family ID:', family.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
