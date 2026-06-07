import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { GeofencesController } from './geofences.controller';
import { GeofencesService } from './geofences.service';

@Module({
  imports: [AlertsModule],
  controllers: [GeofencesController],
  providers: [GeofencesService],
  exports: [GeofencesService],
})
export class GeofencesModule {}
