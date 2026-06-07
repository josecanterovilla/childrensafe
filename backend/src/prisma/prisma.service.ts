import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Cliente Prisma como servicio inyectable. Gestiona la conexión al ciclo de vida de Nest.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Conectado a la base de datos');
    } catch (err) {
      this.logger.error('No se pudo conectar a la base de datos', err as Error);
      throw err;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
