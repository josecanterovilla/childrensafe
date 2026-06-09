import { Module } from '@nestjs/common';
import { MailService } from './mail.service';

/** Envío de correos transaccionales. Lo consume AuthModule para los códigos por correo. */
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
