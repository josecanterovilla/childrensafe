import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const logger = new Logger('Bootstrap');

  // Seguridad de cabeceras HTTP.
  app.use(helmet());

  // CORS restringido a orígenes conocidos.
  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:8080')
    .split(',')
    .map((o) => o.trim());
  app.enableCors({ origin: origins, credentials: true });

  app.setGlobalPrefix('api');

  // Validación estricta: rechaza propiedades no declaradas (anti mass-assignment).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Documentación OpenAPI (solo fuera de producción por defecto).
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('ChildrenSafe API')
      .setDescription('API de la plataforma de seguridad familiar ChildrenSafe')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  const port = parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port);
  logger.log(`ChildrenSafe API escuchando en http://localhost:${port}/api`);
  if (process.env.NODE_ENV !== 'production') {
    logger.log(`Swagger en http://localhost:${port}/docs`);
  }
}

void bootstrap();
