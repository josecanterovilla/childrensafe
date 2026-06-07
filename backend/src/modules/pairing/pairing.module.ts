import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PairingController } from './pairing.controller';
import { PairingService } from './pairing.service';

@Module({
  imports: [AuthModule], // para TokensService
  controllers: [PairingController],
  providers: [PairingService],
})
export class PairingModule {}
