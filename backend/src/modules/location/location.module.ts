import { Module } from '@nestjs/common';
import { GeofencesModule } from '../geofences/geofences.module';
import { LocationController } from './location.controller';
import { LocationService } from './location.service';

@Module({
  imports: [GeofencesModule],
  controllers: [LocationController],
  providers: [LocationService],
})
export class LocationModule {}
