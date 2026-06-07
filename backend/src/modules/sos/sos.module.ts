import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { SosController } from './sos.controller';
import { SosService } from './sos.service';

@Module({
  imports: [AlertsModule],
  controllers: [SosController],
  providers: [SosService],
})
export class SosModule {}
