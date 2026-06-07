import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokensService } from './tokens.service';
import { PasswordService } from './password.service';
import { GoogleVerifier } from './google-verifier.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, TokensService, PasswordService, GoogleVerifier, JwtStrategy],
  exports: [TokensService, PasswordService],
})
export class AuthModule {}
